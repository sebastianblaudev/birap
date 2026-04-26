import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  MapPin, 
  Users, 
  Newspaper, 
  ShieldAlert, 
  Phone, 
  CheckCircle,
  Navigation,
  Heart
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Howl } from 'howler';
import { supabase } from './lib/supabase';

// Mock Data
const VET_DATA = [
  { id: 1, name: "Clínica Veterinaria Santiago", address: "Vicuña Mackenna 123, Santiago", distance: "0.8 km", rating: 4.8 },
  { id: 2, name: "Hospital Animal Las Condes", address: "Apouindo 4567, Las Condes", distance: "3.2 km", rating: 4.9 },
  { id: 3, name: "Vet 24/7 Providencia", address: "Salvador 200, Providencia", distance: "1.5 km", rating: 4.5 },
];

const NEWS_DATA = [
  { 
    id: 1, 
    title: "Rescate Heroico en zona de incendio", 
    preview: "Un perrito fue encontrado abrazando a un carabinero tras ser rescatado...", 
    image: "/rescue_dog.png",
    full: "La brigada BIRAP logró rescatar a 15 animales domésticos en la última jornada. Uno de los momentos más emotivos fue cuando un cachorro de meses no quería soltar a su rescatista...",
    premium: true 
  },
  { 
    id: 2, 
    title: "Nueva tecnología de rastreo", 
    preview: "BIRAP implementa drones integrados con IA para búsqueda nocturna...", 
    image: "https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&q=80&w=400",
    full: "Gracias a los socios premium, hemos adquirido 5 nuevos drones...",
    premium: false 
  }
];

const alertSound = new Howl({
  src: ['https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'],
  loop: true,
  volume: 0.5
});

const App = () => {
  const [view, setView] = useState('USER_HOME');
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [newsList, setNewsList] = useState(NEWS_DATA);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [reportDetails, setReportDetails] = useState({ description: '', location: '', phone: '' });
  const [authData, setAuthData] = useState({ email: '', password: '', isRegistering: false });
  const [volunteerDetails, setVolunteerDetails] = useState({ name: '', type: 'Voluntario General', file: null });
  const [isUploading, setIsUploading] = useState(false);
  const [adminTab, setAdminTab] = useState('ALERTS');
  const [newArticle, setNewArticle] = useState({ title: '', preview: '', image: '', full_content: '', premium: false });
  const [selectedNews, setSelectedNews] = useState(null);

  // Fetch alerts from Supabase (Pending and Accepted)
  const fetchAlerts = async () => {
    const { data, error } = await supabase
      .from('alerts')
      .select('*')
      .in('status', ['pending', 'accepted'])
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setAlerts(data);
      const hasPending = data.some(a => a.status === 'pending');
      if (hasPending && isAdmin) alertSound.play();
    }
  };

  const fetchNews = async () => {
    const { data, error } = await supabase
      .from('news')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error("Error fetching news:", error);
      return;
    }

    if (data) {
      setNewsList(data.length > 0 ? data : NEWS_DATA);
    }
  };

  useEffect(() => {
    // Auth session listener
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) checkUserRole(session.user.id);
    });

    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkUserRole(session.user.id);
      } else {
        setIsAdmin(false);
        setIsPremium(false);
      }
    });

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        setCurrentLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      });
    }

    // Subscribe to changes
    const subscription = supabase
      .channel('alerts_channel')
      .on('postgres_changes', { event: '*', table: 'alerts' }, (payload) => {
        // Refresh all since updates/inserts both matter now
        fetchAlerts();
      })
      .subscribe();

    fetchAlerts();
    fetchNews();

    return () => {
      supabase.removeChannel(subscription);
      authSubscription.unsubscribe();
    };
  }, [isAdmin]);

  const checkUserRole = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role, is_premium')
        .eq('id', userId)
        .single();
      
      if (error && error.code === 'PGRST116') {
        // Profile doesn't exist, create it
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert([{ id: userId, role: 'user', is_premium: false }])
          .select()
          .single();
        
        if (!createError && newProfile) {
          setIsAdmin(false);
          setIsPremium(false);
        }
        return;
      }

      if (data) {
        // Combinamos el rol de DB con el truco del email para el demo
        const isEmailAdmin = user?.email?.includes("admin");
        setIsAdmin(data.role === 'admin' || data.role === 'brigadista' || isEmailAdmin);
        setIsPremium(data.is_premium);
      }
    } catch (err) {
      console.error("Error checking user role:", err);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (authData.isRegistering) {
      const { data, error } = await supabase.auth.signUp({
        email: authData.email,
        password: authData.password,
      });

      if (error) {
        alert("Error al registrarse: " + error.message);
      } else {
        alert("Registro exitoso. Revisa tu correo o inicia sesión directamente.");
        setAuthData({ ...authData, isRegistering: false });
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: authData.email,
        password: authData.password,
      });

      if (error) {
        alert("Error al iniciar sesión: " + error.message);
      } else {
        // Fallback robusto para prueba: Si el correo incluye "admin", forzar vista admin
        if (authData.email.includes("admin")) {
          setIsAdmin(true);
        }
        setView('USER_HOME');
      }
    }
  };

  const handleNewsSubmit = async (e) => {
    e.preventDefault();
    setIsUploading(true);
    const { error } = await supabase.from('news').insert([newArticle]);
    if (error) {
      alert("Error publicando noticia (Revisa tus políticas RLS): " + error.message);
    } else {
      alert("Noticia publicada exitosamente.");
      setNewArticle({ title: '', preview: '', image: '', full_content: '', premium: false });
      fetchNews();
    }
    setIsUploading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setView('USER_HOME');
    alertSound.stop();
  };

  const handleSOS = () => {
    setView('SOS_FORM');
  };

  const submitAlert = async () => {
    const { error } = await supabase.from('alerts').insert([{
      description: reportDetails.description,
      location: reportDetails.location || "Ubicación actual",
      coords: currentLocation,
      phone: reportDetails.phone,
      status: 'pending'
    }]);

    if (error) {
      console.error("Error submitting SOS:", error);
      alert("Error al enviar SOS. Revisa tu conexión.");
      return;
    }
    
    setView('USER_HOME');
    setReportDetails({ description: '', location: '', phone: '' });
    alert("SOS Enviado. Brigadistas han sido notificados en tiempo real.");
  };

  const updateAlertStatus = async (id, status) => {
    const { error } = await supabase
      .from('alerts')
      .update({ status })
      .eq('id', id);

    if (!error) {
      if (status === 'derived' || status === 'resolved') {
        setAlerts(prev => prev.filter(a => a.id !== id));
      } else {
        // Refresh for status changes (e.g. pending -> accepted)
        fetchAlerts();
      }
      
      // Stop sound only if no pending alerts left
      const stillPending = alerts.some(a => a.id !== id && a.status === 'pending');
      if (!stillPending) alertSound.stop();
    }
  };

  const toggleAdmin = () => {
    if (user) {
      if (isAdmin) {
        setView(view === 'ADMIN_DASHBOARD' ? 'USER_HOME' : 'ADMIN_DASHBOARD');
      } else {
        alert("Tu cuenta no tiene permisos de Brigadista.");
      }
    } else {
      setView('LOGIN');
    }
  };

  const stopAlertSound = () => {
    alertSound.stop();
  };

  return (
    <div className="container">
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', padding: '10px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/birap_logo.png" alt="BIRAP Logo" style={{ width: '45px', height: 'auto', filter: 'drop-shadow(0 0 5px rgba(255,59,48,0.3))' }} />
          <div>
            <h1 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 800, letterSpacing: '1px' }}>BIRAP</h1>
            <p style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', margin: 0, textTransform: 'uppercase' }}>Brigada Integral de Rescate</p>
          </div>
        </div>
        <button 
          onClick={user ? handleLogout : toggleAdmin}
          className="glass-morphism" 
          style={{ padding: '6px 14px', fontSize: '0.7rem', border: 'none', cursor: 'pointer', color: 'white', fontWeight: 600 }}
        >
          {user ? 'Cerrar Sesión' : 'Login'}
        </button>
      </header>

      {/* Main Content Areas */}
      <AnimatePresence mode="wait">
        {view === 'USER_HOME' && (
          <motion.div 
            key="home"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fade-in"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}
          >
            <motion.img 
              src="/birap_logo.png" 
              alt="BIRAP Logo Large" 
              style={{ width: '120px', marginBottom: '30px' }}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
            />
            
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
              <h2 style={{ fontSize: '1.8rem', marginBottom: '8px', fontWeight: 800 }}>Ayuda Inmediata</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Presiona en caso de emergencia real</p>
            </div>
            
            <motion.button 
              className="sos-button pulse"
              whileTap={{ scale: 0.9 }}
              onClick={handleSOS}
            >
              SOS
            </motion.button>

            <div style={{ marginTop: 'auto', width: '100%', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px', padding: '20px 0' }}>
              <NavCard icon={<MapPin />} label="Vets Cercanas" onClick={() => setView('VETS')} />
              <NavCard icon={<Newspaper />} label="Noticias" onClick={() => setView('MEMBERSHIP')} />
              <NavCard icon={<Users />} label="Voluntariado" onClick={() => setView('VOLUNTEER')} />
              <NavCard icon={<Heart />} label="Donar" onClick={() => setView('PAYMENT')} />
            </div>
          </motion.div>
        )}

        {view === 'SOS_FORM' && (
          <motion.div 
            key="sos_form"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-morphism"
            style={{ padding: '25px', marginTop: '20px' }}
          >
            <h2 style={{ marginBottom: '20px', color: 'var(--primary)' }}>Detalle de Emergencia</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <label>¿Qué está sucediendo? (Breve)</label>
              <textarea 
                placeholder="Ej: Accidente vehicular con animal herido..."
                style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: 'white', padding: '15px', borderRadius: '12px', minHeight: '100px' }}
                value={reportDetails.description}
                onChange={(e) => setReportDetails({...reportDetails, description: e.target.value})}
              />
              
              <label>Ubicación (Si no es la actual)</label>
              <input 
                type="text"
                placeholder="Calle #, Comuna"
                style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: 'white', padding: '12px', borderRadius: '12px' }}
                value={reportDetails.location}
                onChange={(e) => setReportDetails({...reportDetails, location: e.target.value})}
              />

              <label>Teléfono de contacto</label>
              <input 
                type="tel"
                placeholder="+56 9 ..."
                style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: 'white', padding: '12px', borderRadius: '12px' }}
                value={reportDetails.phone}
                onChange={(e) => setReportDetails({...reportDetails, phone: e.target.value})}
              />

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button onClick={() => setView('USER_HOME')} style={{ flex: 1, padding: '15px', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'white' }}>Cancelar</button>
                <button onClick={submitAlert} className="btn-primary" style={{ flex: 2 }}>ENVIAR ALERTA</button>
              </div>
            </div>
          </motion.div>
        )}

        {view === 'ADMIN_DASHBOARD' && (
          <motion.div key="admin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ width: '100%', paddingBottom: '100px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>Panel Brigadista <span className="admin-badge">EN VIVO</span></h2>
              {alertSound.playing() && (
                <button onClick={stopAlertSound} style={{ background: 'var(--primary)', border: 'none', padding: '5px 10px', borderRadius: '5px', color: 'white' }}>Silenciar</button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <button 
                onClick={() => setAdminTab('ALERTS')}
                style={{ flex: 1, padding: '10px', background: adminTab === 'ALERTS' ? 'var(--primary)' : 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: 'white', borderRadius: '8px' }}>
                Alertas SOS
              </button>
              <button 
                onClick={() => setAdminTab('NEWS')}
                style={{ flex: 1, padding: '10px', background: adminTab === 'NEWS' ? 'var(--secondary)' : 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: 'white', borderRadius: '8px' }}>
                Gestión Noticias
              </button>
            </div>
            
            {adminTab === 'ALERTS' && (
              <>
                {/* Nuevas Alertas */}
                <h3 style={{ fontSize: '0.9rem', color: '#FF3B30', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={16} /> NUEVAS EMERGENCIAS ({alerts.filter(a => a.status === 'pending').length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '30px' }}>
                  {alerts.filter(a => a.status === 'pending').length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '10px' }}>No hay nuevas alertas</p>
                  ) : (
                    alerts.filter(a => a.status === 'pending').map(alert => (
                      <AdminAlertCard key={alert.id} alert={alert} onResolve={(status) => updateAlertStatus(alert.id, status)} />
                    ))
                  )}
                </div>

                {/* En Camino */}
                <h3 style={{ fontSize: '0.9rem', color: '#10B981', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle size={16} /> RESCATES EN CURSO ({alerts.filter(a => a.status === 'accepted').length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {alerts.filter(a => a.status === 'accepted').length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '10px' }}>No hay rescates activos</p>
                  ) : (
                    alerts.filter(a => a.status === 'accepted').map(alert => (
                      <AdminAlertCard key={alert.id} alert={alert} onResolve={(status) => updateAlertStatus(alert.id, status)} />
                    ))
                  )}
                </div>
              </>
            )}

            {adminTab === 'NEWS' && (
              <div className="glass-morphism" style={{ padding: '20px' }}>
                <h3 style={{ marginBottom: '15px', color: 'var(--secondary)' }}>Redactar Nueva Noticia</h3>
                <form onSubmit={handleNewsSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <input 
                    type="text" 
                    placeholder="Título de la noticia" 
                    required
                    style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: 'white', padding: '12px', borderRadius: '12px' }}
                    value={newArticle.title}
                    onChange={(e) => setNewArticle({...newArticle, title: e.target.value})}
                  />
                  <input 
                    type="text" 
                    placeholder="Resumen corto (preview)" 
                    required
                    style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: 'white', padding: '12px', borderRadius: '12px' }}
                    value={newArticle.preview}
                    onChange={(e) => setNewArticle({...newArticle, preview: e.target.value})}
                  />
                  <textarea 
                    placeholder="Contenido completo" 
                    required
                    style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: 'white', padding: '12px', borderRadius: '12px', minHeight: '100px' }}
                    value={newArticle.full_content}
                    onChange={(e) => setNewArticle({...newArticle, full_content: e.target.value})}
                  />
                  <input 
                    type="url" 
                    placeholder="URL de la imagen (ej: https://...)" 
                    required
                    style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: 'white', padding: '12px', borderRadius: '12px' }}
                    value={newArticle.image}
                    onChange={(e) => setNewArticle({...newArticle, image: e.target.value})}
                  />
                  
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={newArticle.premium}
                      onChange={(e) => setNewArticle({...newArticle, premium: e.target.checked})}
                    />
                    ¿Exclusiva para Socios Premium?
                  </label>

                  <button type="submit" className="btn-primary" disabled={isUploading}>
                    {isUploading ? "Publicando..." : "Publicar Noticia"}
                  </button>
                </form>
              </div>
            )}
          </motion.div>
        )}

        {view === 'VETS' && (
          <motion.div key="vets" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <button onClick={() => setView('USER_HOME')} style={{ marginBottom: '20px', background: 'none', border: 'none', color: 'var(--secondary)', cursor: 'pointer' }}>← Volver</button>
            <h2 style={{ marginBottom: '20px' }}>Vets Asociadas BIRAP</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {VET_DATA.map(vet => (
                <div key={vet.id} className="glass-morphism" style={{ padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem' }}>{vet.name}</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{vet.address}</p>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--accent)' }}>★ {vet.rating}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{vet.distance}</span>
                    </div>
                  </div>
                  <Navigation size={20} color="var(--secondary)" />
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {view === 'MEMBERSHIP' && (
          <motion.div key="membership" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <button onClick={() => setView('USER_HOME')} style={{ marginBottom: '20px', background: 'none', border: 'none', color: 'var(--secondary)', cursor: 'pointer' }}>← Volver</button>
            <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>Membresía BIRAP</h2>
              {!isPremium && <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Acceso Básico</span>}
              {isPremium && <span style={{ color: '#10B981', fontSize: '0.8rem', fontWeight: 'bold' }}>Socio Premium ✓</span>}
            </div>

            {!isPremium && (
              <div className="glass-morphism" style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(0,122,255,0.1), rgba(255,59,48,0.1))', border: '1px solid var(--secondary)', marginBottom: '30px' }}>
                <h3>Hazte Socio BIRAP</h3>
                <p style={{ fontSize: '0.9rem', margin: '10px 0' }}>Con solo $1.000 CLP accedes a información completa de rescates y noticias exclusivas en tiempo real.</p>
                <button 
                  onClick={async () => {
                    if (!user) {
                      alert("Debes iniciar sesión para ser socio premium.");
                      setView('LOGIN');
                      return;
                    }
                    setIsUploading(true);
                    const { error } = await supabase
                      .from('profiles')
                      .update({ is_premium: true })
                      .eq('id', user.id);
                    
                    if (!error) {
                      setIsPremium(true);
                      alert("¡Gracias! Ahora eres Socio Premium de BIRAP.");
                    } else {
                      alert("Error al procesar: " + error.message);
                    }
                    setIsUploading(false);
                  }}
                  disabled={isUploading}
                  style={{ width: '100%', padding: '12px', background: 'var(--secondary)', border: 'none', borderRadius: '10px', color: 'white', fontWeight: 'bold', marginTop: '10px' }}
                >
                  {isUploading ? "Procesando..." : "Suscribirse por $1.000 / mes"}
                </button>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {newsList.map(news => (
                <div key={news.id} className="glass-morphism" style={{ overflow: 'hidden' }}>
                  <img src={news.image} style={{ width: '100%', height: '160px', objectFit: 'cover' }} alt={news.title} />
                  <div style={{ padding: '15px' }}>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '5px' }}>{news.title}</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {isPremium || !news.premium ? news.preview : "Contenido solo para socios premium..."}
                    </p>
                    {news.premium && !isPremium && (
                      <button 
                        onClick={() => alert("Debes ser socio premium para leer esta noticia")}
                        style={{ marginTop: '10px', background: 'none', border: '1px solid var(--accent)', color: 'var(--accent)', padding: '5px 12px', borderRadius: '6px', fontSize: '0.8rem' }}
                      >
                        Pagar para leer
                      </button>
                    )}
                    {(isPremium || !news.premium) && (
                      <button 
                        onClick={() => setSelectedNews(news)}
                        style={{ marginTop: '10px', background: 'none', border: '1px solid var(--secondary)', color: 'var(--secondary)', padding: '5px 12px', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>
                        Leer más →
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* News Detail Modal */}
            <AnimatePresence>
              {selectedNews && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1000, padding: '20px', overflowY: 'auto' }}
                >
                  <div className="glass-morphism" style={{ maxWidth: '500px', margin: '40px auto', padding: '0', overflow: 'hidden' }}>
                    <img src={selectedNews.image} style={{ width: '100%', height: '200px', objectFit: 'cover' }} alt={selectedNews.title} />
                    <div style={{ padding: '20px' }}>
                      <h2 style={{ marginBottom: '10px' }}>{selectedNews.title}</h2>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', whiteSpace: 'pre-wrap', marginBottom: '20px' }}>
                        {selectedNews.full_content || selectedNews.full || selectedNews.preview}
                      </p>
                      <button 
                        onClick={() => setSelectedNews(null)}
                        className="btn-primary" 
                        style={{ width: '100%' }}
                      >
                        Cerrar Noticia
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {view === 'PAYMENT' && (
          <motion.div key="payment" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <button onClick={() => setView('USER_HOME')} style={{ marginBottom: '20px', background: 'none', border: 'none', color: 'var(--secondary)', cursor: 'pointer' }}>← Volver</button>
            <h2 style={{ marginBottom: '10px' }}>Donaciones BIRAP</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>Tu aporte ayuda a salvar vidas animales y humanas.</p>
            
            <div className="glass-morphism" style={{ padding: '25px', textAlign: 'center' }}>
              <Heart size={48} color="var(--primary)" style={{ marginBottom: '20px' }} />
              <h3>Selecciona un monto</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', margin: '20px 0' }}>
                {['$1.000', '$5.000', '$10.000', 'Otro'].map(amount => (
                  <button 
                    key={amount}
                    className="glass-morphism"
                    style={{ padding: '15px', border: '1px solid var(--glass-border)', color: 'white', fontWeight: 'bold' }}
                    onClick={async () => {
                      if (amount === 'Otro') {
                        const val = prompt("Ingresa el monto a donar:");
                        if (!val) return;
                      }
                      
                      setIsUploading(true);
                      const numericAmount = parseInt(amount.replace('$', '').replace(/\./g, '')) || 0;
                      
                      const { error } = await supabase.from('donations').insert([{
                        user_id: user?.id || null,
                        amount: numericAmount,
                        status: 'completed'
                      }]);

                      if (!error) {
                        alert("¡Muchas gracias por tu donación! Se ha registrado con éxito.");
                        setView('USER_HOME');
                      } else {
                        console.error("Donation error:", error);
                        alert("Error: " + error.message);
                      }
                      setIsUploading(false);
                    }}
                  >
                    {amount}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Transacción protegida por BIRAP Secure Pay</p>
            </div>
          </motion.div>
        )}

        {view === 'VOLUNTEER' && (
          <motion.div key="volunteer" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <button onClick={() => setView('USER_HOME')} style={{ marginBottom: '20px', background: 'none', border: 'none', color: 'var(--secondary)', cursor: 'pointer' }}>← Volver</button>
            <h2 style={{ marginBottom: '10px' }}>Únete a la Brigada</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>Completa tus datos según tu perfil</p>
            
            <div className="glass-morphism" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <input 
                  type="text" 
                  placeholder="Nombre completo" 
                  style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: 'white', padding: '12px', borderRadius: '12px' }} 
                  value={volunteerDetails.name}
                  onChange={(e) => setVolunteerDetails({...volunteerDetails, name: e.target.value})}
                />
                <select 
                  style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: 'white', padding: '12px', borderRadius: '12px' }}
                  value={volunteerDetails.type}
                  onChange={(e) => setVolunteerDetails({...volunteerDetails, type: e.target.value})}
                >
                  <option>Tipo de Voluntariado</option>
                  <option value="Veterinario">Veterinario</option>
                  <option value="Estudiante Veterinaria">Estudiante Veterinaria</option>
                  <option value="Voluntario General">Voluntario General</option>
                </select>
                
                <label style={{ fontSize: '0.8rem' }}>Comprobante (Título / Certificado Alumno / Antecedentes)</label>
                <input 
                  type="file" 
                  style={{ fontSize: '0.8rem' }} 
                  onChange={(e) => setVolunteerDetails({...volunteerDetails, file: e.target.files[0]})}
                />

                <button 
                  className="btn-primary" 
                  style={{ marginTop: '10px' }} 
                  disabled={isUploading}
                  onClick={async () => {
                    setIsUploading(true);
                    try {
                      let fileUrl = null;
                      if (volunteerDetails.file) {
                        const fileExt = volunteerDetails.file.name.split('.').pop();
                        const fileName = `${Math.random()}.${fileExt}`;
                        const filePath = `${fileName}`;
                        
                        const { error: uploadError } = await supabase.storage
                          .from('volunteer-docs')
                          .upload(filePath, volunteerDetails.file);

                        if (uploadError) throw uploadError;
                        fileUrl = filePath;
                      }

                      const { error } = await supabase.from('volunteers').insert([{
                        name: volunteerDetails.name,
                        type: volunteerDetails.type,
                        document_url: fileUrl,
                        status: 'pending'
                      }]);

                      if (error) throw error;

                      alert("Solicitud enviada. Revisaremos tus antecedentes.");
                      setView('USER_HOME');
                      setVolunteerDetails({ name: '', type: 'Voluntario General', file: null });
                    } catch (error) {
                      alert("Error: " + error.message);
                    } finally {
                      setIsUploading(false);
                    }
                  }}
                >
                  {isUploading ? "Enviando..." : "Enviar Postulación"}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {view === 'LOGIN' && (
          <motion.div 
            key="login"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-morphism"
            style={{ padding: '30px', maxWidth: '400px', margin: '40px auto' }}
          >
            <h2 style={{ textAlign: 'center', marginBottom: '25px' }}>{authData.isRegistering ? 'Registro' : 'Ingreso de Usuario'}</h2>
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Correo Electrónico</label>
                <input 
                  type="email" 
                  required
                  style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: 'white', padding: '12px', borderRadius: '12px' }} 
                  value={authData.email}
                  onChange={(e) => setAuthData({...authData, email: e.target.value})}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Contraseña</label>
                <input 
                  type="password" 
                  required
                  style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: 'white', padding: '12px', borderRadius: '12px' }} 
                  value={authData.password}
                  onChange={(e) => setAuthData({...authData, password: e.target.value})}
                />
              </div>
              <button type="submit" className="btn-primary" style={{ marginTop: '10px', padding: '15px' }}>
                {authData.isRegistering ? 'Crear Cuenta' : 'Ingresar'}
              </button>
              <div style={{ textAlign: 'center', marginTop: '10px' }}>
                <button 
                  type="button" 
                  onClick={() => setAuthData({ ...authData, isRegistering: !authData.isRegistering })}
                  style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontSize: '0.9rem', cursor: 'pointer', marginBottom: '10px' }}
                >
                  {authData.isRegistering ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
                </button>
                <br />
                <button 
                  type="button" 
                  onClick={() => setView('USER_HOME')}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '0.9rem', cursor: 'pointer' }}
                >
                  Volver al inicio
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer Nav for Mobile APK feel */}
      <nav style={{ 
        position: 'fixed', 
        bottom: 0, 
        left: 0, 
        right: 0, 
        height: '70px', 
        background: 'rgba(15, 23, 42, 0.9)', 
        backdropFilter: 'blur(20px)',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingBottom: 'env(safe-area-inset-bottom)',
        borderTop: '1px solid var(--glass-border)'
      }}>
        <NavIcon icon={<ShieldAlert size={24} />} active={view === 'USER_HOME' || view === 'SOS_FORM'} onClick={() => setView('USER_HOME')} />
        <NavIcon icon={<MapPin size={24} />} active={view === 'VETS'} onClick={() => setView('VETS')} />
        <NavIcon icon={<Newspaper size={24} />} active={view === 'MEMBERSHIP'} onClick={() => setView('MEMBERSHIP')} />
        <NavIcon icon={<Users size={24} />} active={view === 'VOLUNTEER'} onClick={() => setView('VOLUNTEER')} />
      </nav>
    </div>
  );
};

const NavCard = ({ icon, label, onClick }) => (
  <button 
    onClick={onClick}
    className="glass-morphism" 
    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '15px', border: 'none', cursor: 'pointer', color: 'white', gap: '8px' }}
  >
    <div style={{ color: 'var(--secondary)' }}>{icon}</div>
    <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>{label}</span>
  </button>
);

const NavIcon = ({ icon, active, onClick }) => (
  <div 
    onClick={onClick}
    style={{ 
      color: active ? 'var(--primary)' : 'var(--text-secondary)', 
      cursor: 'pointer',
      padding: '10px',
      transition: 'color 0.3s'
    }}
  >
    {icon}
  </div>
);

const AdminAlertCard = ({ alert, onResolve }) => (
  <div className="glass-morphism" style={{ 
    padding: '15px', 
    borderLeft: `4px solid ${alert.status === 'pending' ? 'var(--primary)' : '#10B981'}`, 
    position: 'relative',
    opacity: alert.status === 'accepted' ? 0.9 : 1
  }}>
    <div style={{ position: 'absolute', top: '10px', right: '15px', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
      {alert.created_at ? new Date(alert.created_at).toLocaleTimeString() : 'Ahora'}
    </div>
    
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
      <h3 style={{ fontSize: '1rem', color: alert.status === 'pending' ? 'var(--primary)' : '#10B981', margin: 0 }}>
        {alert.status === 'pending' ? 'NUEVO SOS' : 'EN PROCESO'}
      </h3>
    </div>

    <p style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '5px' }}>{alert.description}</p>
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
      <MapPin size={14} /> {alert.location}
    </div>
    
    <div style={{ display: 'flex', gap: '10px' }}>
      <a href={`tel:${alert.phone}`} style={{ textDecoration: 'none', flex: 1.5 }}>
        <button className="btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', fontSize: '0.8rem' }}>
          <Phone size={16} /> Llamar Solicitante
        </button>
      </a>
      
      {alert.status === 'pending' ? (
        <>
          <button 
            onClick={() => onResolve('accepted')}
            style={{ flex: 1, background: '#10B981', border: 'none', borderRadius: '12px', color: 'white', fontWeight: 'bold', fontSize: '0.75rem' }}
          >
            Aceptar
          </button>
          <button 
            onClick={() => onResolve('derived')}
            style={{ flex: 1, background: 'var(--secondary)', border: 'none', borderRadius: '12px', color: 'white', fontWeight: 'bold', fontSize: '0.75rem' }}
          >
            Derivar
          </button>
        </>
      ) : (
        <button 
          onClick={() => onResolve('resolved')}
          style={{ flex: 1, background: '#6366F1', border: 'none', borderRadius: '12px', color: 'white', fontWeight: 'bold', fontSize: '0.75rem' }}
        >
          Finalizar Rescate
        </button>
      )}
    </div>
  </div>
);

export default App;
