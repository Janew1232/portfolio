import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Phone, Facebook, MessageCircle, ArrowRight, Palette, Layout, Image as ImageIcon, PenTool, Menu, X, ExternalLink, Lock, LogOut, Plus, Trash2 } from 'lucide-react';
import { auth, db, googleProvider } from './firebase';
import { signInWithPopup, signInWithEmailAndPassword, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function App() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [user, setUser] = useState<User | null>(null);
  const [portfolioItems, setPortfolioItems] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState({ img: '', title: '', category: 'Social Media' });
  const [selectedImage, setSelectedImage] = useState<any | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    const q = query(collection(db, 'portfolio'), orderBy('createdAt', 'desc'));
    const unsubscribeDb = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPortfolioItems(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'portfolio');
    });

    return () => {
      unsubscribeAuth();
      unsubscribeDb();
    };
  }, []);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoginError('');
    try {
      if (loginEmail && loginPassword) {
        await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
        setShowLoginModal(false);
        setLoginEmail('');
        setLoginPassword('');
      } else {
        await signInWithPopup(auth, googleProvider);
        setShowLoginModal(false);
      }
    } catch (error: any) {
      console.error("Login failed", error);
      if (error.code === 'auth/operation-not-allowed') {
        setLoginError("Email/Password login is not enabled. Please enable it in the Firebase Console under Authentication > Sign-in method.");
      } else {
        setLoginError(error.message || "Failed to login. Please check your credentials.");
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.img || !newItem.title || !newItem.category) return;
    
    setIsUploading(true);
    setUploadProgress(0);
    setUploadMessage(null);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.floor(Math.random() * 15) + 5;
      });
    }, 200);

    try {
      await addDoc(collection(db, 'portfolio'), {
        ...newItem,
        createdAt: Date.now()
      });
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploadMessage({ type: 'success', text: 'Portfolio item added successfully!' });
      
      setTimeout(() => {
        setNewItem({ img: '', title: '', category: 'Social Media' });
        setIsAdding(false);
        setIsUploading(false);
        setUploadProgress(0);
        setUploadMessage(null);
      }, 2000);
      
    } catch (error) {
      clearInterval(progressInterval);
      setUploadProgress(0);
      setIsUploading(false);
      setUploadMessage({ type: 'error', text: 'Failed to add item. Please try again.' });
      handleFirestoreError(error, OperationType.CREATE, 'portfolio');
    }
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDoc(doc(db, 'portfolio', itemToDelete));
      setItemToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `portfolio/${itemToDelete}`);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        setNewItem({ ...newItem, img: dataUrl });
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const filteredItems = activeCategory === 'All' 
    ? portfolioItems 
    : portfolioItems.filter(item => item.category === activeCategory);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-amber-500/30">
      {/* Navigation */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${isScrolled ? 'bg-[#0a0a0a]/90 backdrop-blur-md border-b border-white/5 py-4' : 'bg-transparent py-6'}`}>
        <div className="max-w-7xl mx-auto px-6 md:px-12 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-amber-500 p-1.5 rounded-lg">
              <PenTool size={20} className="text-black" />
            </div>
            <div className="font-serif text-2xl font-bold tracking-tight">
              MD Jahid Hasan<span className="text-amber-500">.</span>
            </div>
          </div>
          
          {/* Desktop Nav */}
          <div className="hidden md:flex items-center space-x-8 text-sm uppercase tracking-widest text-gray-400">
            <button onClick={() => scrollToSection('about')} className="hover:text-white transition-colors cursor-pointer">About</button>
            <button onClick={() => scrollToSection('services')} className="hover:text-white transition-colors cursor-pointer">Services</button>
            <button onClick={() => scrollToSection('portfolio')} className="hover:text-white transition-colors cursor-pointer">Portfolio</button>
            <button onClick={() => scrollToSection('contact')} className="hover:text-white transition-colors cursor-pointer">Contact</button>
          </div>

          {/* Mobile Menu Toggle */}
          <button className="md:hidden text-white cursor-pointer" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* Mobile Nav */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-40 bg-[#0a0a0a] pt-24 px-6 flex flex-col space-y-8 text-xl font-serif"
          >
            <button onClick={() => scrollToSection('about')} className="text-left border-b border-white/10 pb-4 cursor-pointer">About Me</button>
            <button onClick={() => scrollToSection('services')} className="text-left border-b border-white/10 pb-4 cursor-pointer">Services</button>
            <button onClick={() => scrollToSection('portfolio')} className="text-left border-b border-white/10 pb-4 cursor-pointer">Portfolio</button>
            <button onClick={() => scrollToSection('contact')} className="text-left border-b border-white/10 pb-4 cursor-pointer">Contact</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#050505]/80 to-[#050505] z-10"></div>
          <img 
            src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop" 
            alt="Abstract Design Background" 
            className="w-full h-full object-cover opacity-30"
            referrerPolicy="no-referrer"
          />
        </div>
        
        <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10 w-full">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="max-w-3xl"
          >
            <p className="text-amber-500 uppercase tracking-[0.2em] text-sm font-semibold mb-4">Graphic Designer</p>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-serif font-bold leading-[1.1] mb-6">
              Crafting <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500">Visual</span> <br/>
              Excellence.
            </h1>
            <p className="text-gray-400 text-lg md:text-xl max-w-xl mb-10 font-light leading-relaxed">
              Hi, I'm MD Jahid Hasan. A passionate graphic designer from Bangladesh, dedicated to elevating brands through creative and luxury-style design solutions.
            </p>
            
            <div className="flex flex-wrap gap-4">
              <button 
                onClick={() => scrollToSection('portfolio')}
                className="bg-white text-black px-8 py-4 rounded-full font-medium flex items-center gap-2 hover:bg-gray-200 transition-colors cursor-pointer"
              >
                View My Work <ArrowRight size={18} />
              </button>
              <button 
                onClick={() => scrollToSection('contact')}
                className="border border-white/20 px-8 py-4 rounded-full font-medium hover:bg-white/5 transition-colors cursor-pointer"
              >
                Let's Talk
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-24 md:py-32 bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="relative"
            >
              <div className="aspect-[4/5] rounded-2xl overflow-hidden relative">
                <img 
                  src="https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?q=80&w=1000&auto=format&fit=crop" 
                  alt="MD Jahid Hasan - Creative Workspace" 
                  className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 border border-white/10 rounded-2xl"></div>
              </div>
              <div className="absolute -bottom-8 -right-8 bg-[#111] p-8 rounded-2xl border border-white/5 hidden md:block">
                <p className="text-4xl font-serif text-amber-500 mb-2">5+</p>
                <p className="text-sm text-gray-400 uppercase tracking-wider">Years of<br/>Experience</p>
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <h2 className="text-sm text-amber-500 uppercase tracking-[0.2em] font-semibold mb-4">About Me</h2>
              <h3 className="text-4xl md:text-5xl font-serif mb-8 leading-tight">Designing with purpose and passion.</h3>
              <div className="space-y-6 text-gray-400 font-light leading-relaxed">
                <p>
                  Based in Bangladesh, I specialize in creating visually compelling designs that communicate your brand's unique story. My approach blends modern aesthetics with functional design principles.
                </p>
                <p>
                  Whether it's a striking logo, an engaging social media campaign, or professional print materials, I focus on delivering high-quality, luxury-style graphics that leave a lasting impression.
                </p>
              </div>
              
              <div className="mt-10 grid grid-cols-2 gap-6">
                <div>
                  <h4 className="text-white font-medium mb-2">Location</h4>
                  <p className="text-gray-500 text-sm">Bangladesh</p>
                </div>
                <div>
                  <h4 className="text-white font-medium mb-2">Email</h4>
                  <p className="text-gray-500 text-sm">jahidhasan47099@gmail.com</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-24 md:py-32 bg-[#050505]">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="text-center max-w-2xl mx-auto mb-20">
            <h2 className="text-sm text-amber-500 uppercase tracking-[0.2em] font-semibold mb-4">My Expertise</h2>
            <h3 className="text-4xl md:text-5xl font-serif mb-6">Premium Design Services</h3>
            <p className="text-gray-400 font-light">Tailored graphic design solutions to elevate your brand identity and marketing efforts.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: <Layout size={32} />, title: "Social Media Posts", desc: "Engaging and brand-consistent graphics for Instagram, Facebook, and LinkedIn." },
              { icon: <ImageIcon size={32} />, title: "Flyers & Posters", desc: "Eye-catching print and digital promotional materials for events and marketing." },
              { icon: <Palette size={32} />, title: "Banner Design", desc: "Professional web banners, roll-ups, and billboard designs that demand attention." },
              { icon: <PenTool size={32} />, title: "Logo Design", desc: "Memorable, timeless, and versatile brand marks that represent your core values." }
            ].map((service, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-[#0a0a0a] p-8 rounded-2xl border border-white/5 hover:border-amber-500/30 transition-colors group"
              >
                <div className="text-gray-500 group-hover:text-amber-500 transition-colors mb-6">
                  {service.icon}
                </div>
                <h4 className="text-xl font-serif mb-3">{service.title}</h4>
                <p className="text-gray-500 text-sm leading-relaxed font-light">{service.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Portfolio Section */}
      <section id="portfolio" className="py-24 md:py-32 bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
            <div className="max-w-2xl">
              <h2 className="text-sm text-amber-500 uppercase tracking-[0.2em] font-semibold mb-4">Selected Works</h2>
              <h3 className="text-4xl md:text-5xl font-serif">A showcase of creativity.</h3>
            </div>
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="flex gap-4 overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
                {['All', 'Social Media', 'Print Design', 'Banners', 'Digital Art'].map((cat, i) => (
                  <button 
                    key={i} 
                    onClick={() => setActiveCategory(cat)}
                    className={`whitespace-nowrap px-4 py-2 rounded-full text-sm border cursor-pointer transition-colors ${
                      activeCategory === cat 
                        ? 'border-white text-white' 
                        : 'border-white/10 text-gray-400 hover:text-white hover:border-white/30'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              {user && (
                <button 
                  onClick={() => setIsAdding(!isAdding)}
                  className="flex items-center gap-2 bg-amber-500 text-black px-4 py-2 rounded-full text-sm font-medium hover:bg-amber-400 transition-colors"
                >
                  {isAdding ? <X size={16} /> : <Plus size={16} />}
                  {isAdding ? 'Cancel' : 'Add Item'}
                </button>
              )}
            </div>
          </div>

          <AnimatePresence>
            {isAdding && user && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-12 bg-[#111] p-6 md:p-8 rounded-2xl border border-white/10 overflow-hidden"
              >
                <h4 className="text-xl font-serif mb-6 text-amber-500">Add New Portfolio Item</h4>
                <form onSubmit={handleAddItem} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm text-gray-500 mb-2">Upload Image</label>
                    <input 
                      type="file" 
                      accept="image/*"
                      required
                      onChange={handleImageUpload}
                      className="w-full bg-transparent border-b border-white/10 py-2 text-white focus:outline-none focus:border-amber-500 transition-colors file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-amber-500 file:text-black hover:file:bg-amber-400" 
                    />
                    {newItem.img && (
                      <div className="mt-4">
                        <img src={newItem.img} alt="Preview" className="h-20 w-20 object-cover rounded-lg border border-white/10" />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 mb-2">Title</label>
                    <input 
                      type="text" 
                      required
                      value={newItem.title}
                      onChange={(e) => setNewItem({...newItem, title: e.target.value})}
                      className="w-full bg-transparent border-b border-white/10 py-2 text-white focus:outline-none focus:border-amber-500 transition-colors" 
                      placeholder="Project Title" 
                    />
                  </div>
                  <div className="md:col-span-2 flex items-end gap-6">
                    <div className="flex-1">
                      <label className="block text-sm text-gray-500 mb-2">Category</label>
                      <select 
                        value={newItem.category}
                        onChange={(e) => setNewItem({...newItem, category: e.target.value})}
                        className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg py-3 px-4 text-white focus:outline-none focus:border-amber-500 transition-colors"
                      >
                        <option value="Social Media">Social Media</option>
                        <option value="Print Design">Print Design</option>
                        <option value="Banners">Banners</option>
                        <option value="Digital Art">Digital Art</option>
                      </select>
                    </div>
                    <button 
                      type="submit" 
                      disabled={isUploading}
                      className="bg-white text-black px-8 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isUploading ? 'Saving...' : 'Save Item'}
                    </button>
                  </div>
                  
                  {/* Progress and Messages */}
                  <div className="md:col-span-2">
                    {isUploading && (
                      <div className="w-full bg-white/10 rounded-full h-2 mb-2 overflow-hidden">
                        <motion.div 
                          className="bg-amber-500 h-2 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${uploadProgress}%` }}
                          transition={{ duration: 0.2 }}
                        />
                      </div>
                    )}
                    {uploadMessage && (
                      <motion.p 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`text-sm ${uploadMessage.type === 'success' ? 'text-green-500' : 'text-red-500'}`}
                      >
                        {uploadMessage.text}
                      </motion.p>
                    )}
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredItems.map((item) => (
                <motion.div 
                  key={item.id || item.title}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.3 }}
                  className="group relative aspect-[4/5] rounded-2xl overflow-hidden cursor-pointer"
                  onClick={() => setSelectedImage(item)}
                >
                  <img 
                    src={item.img} 
                    alt={item.title} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-8">
                    <p className="text-amber-500 text-sm font-medium mb-2">{item.category}</p>
                    <h4 className="text-xl font-serif text-white flex items-center justify-between">
                      {item.title}
                      <ExternalLink size={20} className="text-white/50" />
                    </h4>
                  </div>
                  {user && item.id && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setItemToDelete(item.id);
                      }}
                      className="absolute top-4 right-4 bg-red-500/80 hover:bg-red-500 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all z-20"
                      title="Delete Item"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-24 md:py-32 bg-[#050505] relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-amber-500/5 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <h2 className="text-sm text-amber-500 uppercase tracking-[0.2em] font-semibold mb-4">Get In Touch</h2>
              <h3 className="text-4xl md:text-6xl font-serif mb-6 leading-tight">Let's create something extraordinary.</h3>
              <p className="text-gray-400 font-light mb-12 max-w-md">
                Ready to elevate your brand's visual identity? Reach out to discuss your next project.
              </p>

              <div className="space-y-8">
                <a href="tel:+8801407120371" className="flex items-center gap-6 group">
                  <div className="w-14 h-14 rounded-full border border-white/10 flex items-center justify-center group-hover:border-amber-500 group-hover:bg-amber-500/10 transition-all">
                    <Phone size={20} className="text-gray-400 group-hover:text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Phone & WhatsApp</p>
                    <p className="text-xl font-serif">+880 1407 120371</p>
                  </div>
                </a>
                
                <a href="mailto:jahidhasan47099@gmail.com" className="flex items-center gap-6 group">
                  <div className="w-14 h-14 rounded-full border border-white/10 flex items-center justify-center group-hover:border-amber-500 group-hover:bg-amber-500/10 transition-all">
                    <Mail size={20} className="text-gray-400 group-hover:text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Email</p>
                    <p className="text-xl font-serif">jahidhasan47099@gmail.com</p>
                  </div>
                </a>

                <a href="https://www.facebook.com/MDJahidHasanGD" target="_blank" rel="noopener noreferrer" className="flex items-center gap-6 group">
                  <div className="w-14 h-14 rounded-full border border-white/10 flex items-center justify-center group-hover:border-[#1877F2] group-hover:bg-[#1877F2]/10 transition-all">
                    <Facebook size={20} className="text-gray-400 group-hover:text-[#1877F2]" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Facebook</p>
                    <p className="text-xl font-serif">MD Jahid Hasan</p>
                  </div>
                </a>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="bg-[#0a0a0a] p-8 md:p-12 rounded-3xl border border-white/5"
            >
              <h4 className="text-2xl font-serif mb-8">Send a Message</h4>
              <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                <div>
                  <label className="block text-sm text-gray-500 mb-2">Name</label>
                  <input type="text" className="w-full bg-transparent border-b border-white/10 py-3 text-white focus:outline-none focus:border-amber-500 transition-colors" placeholder="John Doe" />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-2">Email</label>
                  <input type="email" className="w-full bg-transparent border-b border-white/10 py-3 text-white focus:outline-none focus:border-amber-500 transition-colors" placeholder="john@example.com" />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-2">Project Details</label>
                  <textarea rows={4} className="w-full bg-transparent border-b border-white/10 py-3 text-white focus:outline-none focus:border-amber-500 transition-colors resize-none" placeholder="Tell me about your project..."></textarea>
                </div>
                <button className="w-full bg-white text-black py-4 rounded-full font-medium hover:bg-gray-200 transition-colors mt-4 cursor-pointer">
                  Submit Inquiry
                </button>
              </form>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-white/5 bg-[#050505] text-center">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="bg-amber-500 p-1.5 rounded-lg">
              <PenTool size={18} className="text-black" />
            </div>
            <div className="font-serif text-xl font-bold tracking-tight">
              MD Jahid Hasan<span className="text-amber-500">.</span>
            </div>
          </div>
          <p className="text-gray-600 text-sm">
            &copy; {new Date().getFullYear()} MD Jahid Hasan. All rights reserved.
          </p>
          <div className="flex gap-4 items-center">
            <a href="https://wa.me/8801407120371" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-green-500 transition-colors">
              <MessageCircle size={20} />
            </a>
            <a href="https://www.facebook.com/MDJahidHasanGD" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-[#1877F2] transition-colors">
              <Facebook size={20} />
            </a>
            <a href="mailto:jahidhasan47099@gmail.com" className="text-gray-500 hover:text-white transition-colors">
              <Mail size={20} />
            </a>
            {user ? (
              <button onClick={handleLogout} className="text-gray-500 hover:text-red-500 transition-colors ml-4" title="Logout">
                <LogOut size={20} />
              </button>
            ) : (
              <button onClick={() => setShowLoginModal(true)} className="text-gray-500 hover:text-white transition-colors ml-4" title="Admin Login">
                <Lock size={20} />
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Login Modal */}
      <AnimatePresence>
        {showLoginModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
            onClick={() => setShowLoginModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#0a0a0a] border border-white/10 p-8 rounded-2xl max-w-md w-full relative"
              onClick={e => e.stopPropagation()}
            >
              <button 
                onClick={() => setShowLoginModal(false)}
                className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
              <h3 className="text-2xl font-serif text-white mb-6 text-center">Admin Login</h3>
              
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-500 mb-2">Email</label>
                  <input 
                    type="email" 
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full bg-transparent border border-white/10 rounded-lg py-3 px-4 text-white focus:outline-none focus:border-amber-500 transition-colors" 
                    placeholder="admin@example.com" 
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-2">Password</label>
                  <input 
                    type="password" 
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full bg-transparent border border-white/10 rounded-lg py-3 px-4 text-white focus:outline-none focus:border-amber-500 transition-colors" 
                    placeholder="••••••••" 
                  />
                </div>
                
                {loginError && (
                  <p className="text-red-500 text-sm">{loginError}</p>
                )}
                
                <button 
                  type="submit"
                  className="w-full bg-amber-500 text-black py-3 rounded-lg font-medium hover:bg-amber-400 transition-colors mt-4"
                >
                  Login
                </button>
              </form>
              
              <div className="mt-6 flex items-center justify-center">
                <div className="h-px bg-white/10 flex-1"></div>
                <span className="px-4 text-sm text-gray-500">OR</span>
                <div className="h-px bg-white/10 flex-1"></div>
              </div>
              
              <button 
                onClick={() => handleLogin()}
                type="button"
                className="w-full bg-white text-black py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors mt-6 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {itemToDelete && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
            onClick={() => setItemToDelete(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#0a0a0a] border border-white/10 p-8 rounded-2xl max-w-sm w-full"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-xl font-serif text-white mb-4">Delete Item?</h3>
              <p className="text-gray-400 mb-8">Are you sure you want to delete this portfolio item? This action cannot be undone.</p>
              <div className="flex justify-end gap-4">
                <button 
                  onClick={() => setItemToDelete(null)}
                  className="px-6 py-2 rounded-lg font-medium text-gray-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDelete}
                  className="bg-red-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-red-600 transition-colors cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedImage(null)}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 md:p-12 cursor-zoom-out"
          >
            <button 
              onClick={() => setSelectedImage(null)}
              className="absolute top-6 right-6 text-white/70 hover:text-white transition-colors z-[110]"
            >
              <X size={32} />
            </button>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative max-w-6xl w-full max-h-full flex flex-col items-center justify-center cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <img 
                src={selectedImage.img} 
                alt={selectedImage.title} 
                className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
                referrerPolicy="no-referrer"
              />
              <div className="mt-6 text-center">
                <h3 className="text-2xl font-serif text-white mb-2">{selectedImage.title}</h3>
                <p className="text-amber-500 tracking-widest uppercase text-sm font-medium">{selectedImage.category}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
