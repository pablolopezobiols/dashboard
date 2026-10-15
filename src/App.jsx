import React, { useState, useEffect } from 'react';

export default function MinimalistDashboard() {
  // Estados
  const [events, setEvents] = useState([]);
  const [eventForm, setEventForm] = useState({ name: '', date: '', time: '', notifyBefore: '0' });
  const [selectedDay, setSelectedDay] = useState(null);
  
  const [works, setWorks] = useState([]);
  const [workForm, setWorkForm] = useState({ name: '', date: '', hours: '' });
  
  const [invoices, setInvoices] = useState([]);
  const [activeTab, setActiveTab] = useState('trabajos'); // 'trabajos' | 'facturas'

  const PRICE_PER_HOUR = 6000;

  // Cargar de LocalStorage al iniciar
  useEffect(() => {
    const savedEvents = JSON.parse(localStorage.getItem('dash_events') || '[]');
    const savedWorks = JSON.parse(localStorage.getItem('dash_works') || '[]');
    const savedInvoices = JSON.parse(localStorage.getItem('dash_invoices') || '[]');
    setEvents(savedEvents);
    setWorks(savedWorks);
    setInvoices(savedInvoices);
    
    // Pedir permisos para notificaciones del navegador
    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }, []);

  // Guardar en LocalStorage cada vez que cambien los datos
  useEffect(() => {
    localStorage.setItem('dash_events', JSON.stringify(events));
    localStorage.setItem('dash_works', JSON.stringify(works));
    localStorage.setItem('dash_invoices', JSON.stringify(invoices));
  }, [events, works, invoices]);

  // Lógica del sistema de notificaciones
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      let updatedEvents = [...events];
      let changed = false;

      updatedEvents.forEach(evt => {
        if (!evt.notified) {
          const eventDate = new Date(`${evt.date}T${evt.time}`);
          const notifyTime = new Date(eventDate.getTime() - (parseInt(evt.notifyBefore) * 60000));
          
          // Si ya pasó el momento de notificar y todavía no es el evento
          if (now >= notifyTime && now < eventDate) {
            if (Notification.permission === 'granted') {
              new Notification('Recordatorio de Evento', {
                body: `${evt.name} está programado para las ${evt.time}.`
              });
            }
            evt.notified = true;
            changed = true;
          }
        }
      });

      if (changed) {
        setEvents(updatedEvents);
      }
    }, 30000); // Comprobar cada 30 segundos

    return () => clearInterval(interval);
  }, [events]);

  // Handlers del Calendario
  const handleAddEvent = (e) => {
    e.preventDefault();
    if (!eventForm.name || !eventForm.date || !eventForm.time) return;
    setEvents([...events, { id: Date.now(), ...eventForm, notified: false }]);
    setEventForm({ name: '', date: '', time: '', notifyBefore: '0' });
  };

  // Handlers de Trabajos
  const handleAddWork = (e) => {
    e.preventDefault();
    if (!workForm.name || !workForm.date || !workForm.hours) return;
    setWorks([...works, { 
      id: Date.now(), 
      ...workForm, 
      hours: parseFloat(workForm.hours), 
      isPaid: false 
    }]);
    setWorkForm({ name: '', date: '', hours: '' });
  };

  // Generador de Facturas (Agrupa trabajos pendientes)
  const generateInvoice = () => {
    const pendingWorks = works.filter(w => !w.isPaid);
    if (pendingWorks.length === 0) {
      alert('No hay trabajos pendientes para facturar.');
      return;
    }
    
    const total = pendingWorks.reduce((sum, w) => sum + (w.hours * PRICE_PER_HOUR), 0);
    const newInvoice = {
      id: `FAC-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString().split('T')[0],
      amount: total,
      items: pendingWorks
    };
    
    setInvoices([newInvoice, ...invoices]);
    // Marca los trabajos como pagados y vinculados a la factura
    setWorks(works.map(w => w.isPaid ? w : { ...w, isPaid: true, invoiceId: newInvoice.id }));
    setActiveTab('facturas'); // Cambia a la pestaña de facturas
  };

  // Exportar a CSV (Excel/Sheets)
  const exportCSV = () => {
    const headers = "ID,Trabajo,Fecha,Horas,Monto,Estado\n";
    const rows = works.map(w => `${w.id},${w.name},${w.date},${w.hours},${w.hours * PRICE_PER_HOUR},${w.isPaid ? 'Pagado' : 'Pendiente'}`).join("\n");
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `trabajos_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Exportar/Importar Base de Datos Completa (JSON)
  const exportJSON = () => {
    const data = JSON.stringify({ works, events, invoices }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `backup_dashboard_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const importJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.works) setWorks(data.works);
        if (data.events) setEvents(data.events);
        if (data.invoices) setInvoices(data.invoices);
        alert("Datos importados correctamente");
      } catch (err) {
        alert("Error al importar el archivo. Asegúrate de que sea el backup correcto.");
      }
    };
    reader.readAsText(file);
  };

  // Cálculos del Calendario Visual
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  
  const blanks = Array(firstDay).fill(null);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const monthName = today.toLocaleString('es-ES', { month: 'long', year: 'numeric' });

  // Cálculos Financieros
  const totalEarnings = works.reduce((sum, w) => sum + (w.hours * PRICE_PER_HOUR), 0);
  const pendingEarnings = works.filter(w => !w.isPaid).reduce((sum, w) => sum + (w.hours * PRICE_PER_HOUR), 0);

  return (
    <div className="min-h-screen bg-black text-gray-100 p-4 md:p-8 font-sans selection:bg-white selection:text-black">
      
      {/* HEADER GENERAL */}
      <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end border-b border-[#222] pb-6 gap-4 hide-on-print">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-white">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Organización y Finanzas</p>
        </div>
        <div className="flex gap-8 text-right">
          <div>
            <p className="text-sm text-gray-500">Pendiente de Cobro</p>
            <p className="text-xl font-medium text-red-400">${pendingEarnings.toLocaleString('es-AR')}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Ingresos Totales</p>
            <p className="text-2xl font-medium text-white">${totalEarnings.toLocaleString('es-AR')}</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 hide-on-print">
        
        {/* PANEL IZQUIERDO: CALENDARIO */}
        <section className="lg:col-span-4 flex flex-col gap-8">
          
          <div className="bg-[#0a0a0a] border border-[#222] p-6 rounded-2xl relative">
            <h2 className="text-lg font-medium text-white mb-6 capitalize">{monthName}</h2>
            <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2 text-gray-500">
              <div>Do</div><div>Lu</div><div>Ma</div><div>Mi</div><div>Ju</div><div>Vi</div><div>Sa</div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-sm">
              {blanks.map((_, i) => <div key={`blank-${i}`} className="p-2" />)}
              {days.map(day => {
                const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayEvents = events.filter(e => e.date === dateStr);
                const hasEvent = dayEvents.length > 0;
                const isSelected = selectedDay === dateStr;
                
                return (
                  <div 
                    key={day} 
                    onClick={() => hasEvent ? setSelectedDay(isSelected ? null : dateStr) : null}
                    className={`p-2 flex justify-center items-center rounded-full w-8 h-8 mx-auto transition-all cursor-pointer 
                      ${isSelected ? 'bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.5)]' : hasEvent ? 'bg-white text-black font-bold hover:bg-gray-200' : 'text-gray-400 hover:bg-[#222]'}`}
                  >
                    {day}
                  </div>
                );
              })}
            </div>

            {/* Panel flotante con eventos del día clickeado */}
            {selectedDay && (
              <div className="mt-6 p-4 bg-[#111] border border-[#333] rounded-xl shadow-2xl animate-fade-in">
                <div className="flex justify-between items-center mb-4 border-b border-[#222] pb-2">
                  <h4 className="text-white font-medium text-sm">Eventos del {selectedDay.split('-').reverse().join('/')}</h4>
                  <button onClick={() => setSelectedDay(null)} className="text-gray-500 hover:text-white text-xs">✕ CERRAR</button>
                </div>
                <ul className="space-y-3">
                  {events.filter(e => e.date === selectedDay).map(evt => (
                    <li key={evt.id} className="text-sm text-gray-300 border-l-2 border-blue-500 pl-3 py-1">
                      <p className="font-medium text-white">{evt.name}</p>
                      <p className="text-xs text-gray-500 mt-1">🕒 {evt.time} hs - Notificar {evt.notifyBefore}m antes</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Formulario de Calendario */}
          <div className="bg-[#0a0a0a] border border-[#222] p-6 rounded-2xl">
            <h3 className="text-sm font-medium text-gray-400 mb-4 uppercase tracking-widest">Agendar Evento</h3>
            <form onSubmit={handleAddEvent} className="flex flex-col gap-5">
              <input 
                type="text" 
                placeholder="Nombre del evento o cita" 
                value={eventForm.name}
                onChange={e => setEventForm({...eventForm, name: e.target.value})}
                className="w-full bg-transparent border-b border-[#333] pb-2 text-white focus:outline-none focus:border-white transition-colors"
                required
              />
              <div className="grid grid-cols-2 gap-4">
                <input 
                  type="date" 
                  value={eventForm.date}
                  onChange={e => setEventForm({...eventForm, date: e.target.value})}
                  className="w-full bg-transparent border-b border-[#333] pb-2 text-gray-300 focus:outline-none focus:border-white transition-colors text-sm [color-scheme:dark]"
                  required
                />
                <input 
                  type="time" 
                  value={eventForm.time}
                  onChange={e => setEventForm({...eventForm, time: e.target.value})}
                  className="w-full bg-transparent border-b border-[#333] pb-2 text-gray-300 focus:outline-none focus:border-white transition-colors text-sm [color-scheme:dark]"
                  required
                />
              </div>
              
              {/* Opciones de Notificación */}
              <div>
                <label className="text-xs text-gray-500 mb-2 block">Notificarme mediante el navegador:</label>
                <select 
                  value={eventForm.notifyBefore}
                  onChange={e => setEventForm({...eventForm, notifyBefore: e.target.value})}
                  className="w-full bg-[#111] border border-[#333] p-2.5 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-white transition-colors"
                >
                  <option value="0">A la hora exacta</option>
                  <option value="5">5 minutos antes</option>
                  <option value="15">15 minutos antes</option>
                  <option value="30">30 minutos antes</option>
                  <option value="60">1 hora antes</option>
                </select>
              </div>

              <button type="submit" className="mt-2 bg-white text-black font-medium py-3 rounded-lg hover:bg-gray-200 transition-colors text-sm">
                Guardar en Calendario
              </button>
            </form>
          </div>
        </section>

        {/* PANEL DERECHO: BASE DE DATOS Y FACTURAS */}
        <section className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Navegación de Pestañas */}
          <div className="flex gap-6 border-b border-[#222]">
            <button 
              onClick={() => setActiveTab('trabajos')}
              className={`pb-3 text-sm font-medium transition-all ${activeTab === 'trabajos' ? 'text-white border-b-2 border-white' : 'text-gray-600 hover:text-gray-300'}`}
            >
              Base de Datos de Trabajos
            </button>
            <button 
              onClick={() => setActiveTab('facturas')}
              className={`pb-3 text-sm font-medium transition-all ${activeTab === 'facturas' ? 'text-white border-b-2 border-white' : 'text-gray-600 hover:text-gray-300'}`}
            >
              Facturas y Reportes Mensuales
            </button>
          </div>

          {activeTab === 'trabajos' ? (
            <>
              {/* Herramientas de Importación/Exportación */}
              <div className="bg-gradient-to-r from-[#111] to-[#0a0a0a] border border-[#222] p-4 rounded-xl flex flex-wrap gap-4 items-center">
                <span className="text-xs text-gray-500 font-medium mr-auto uppercase tracking-widest">Base de Datos</span>
                <button onClick={exportCSV} className="text-xs border border-[#333] bg-black text-gray-300 px-4 py-2 rounded hover:text-white hover:border-white transition-colors flex items-center gap-2">
                  <span className="text-green-500">📊</span> Exportar a Excel (CSV)
                </button>
                <button onClick={exportJSON} className="text-xs border border-[#333] bg-black text-gray-300 px-4 py-2 rounded hover:text-white hover:border-white transition-colors flex items-center gap-2">
                  <span className="text-blue-500">💾</span> Guardar Backup (JSON)
                </button>
                <label className="text-xs border border-[#333] bg-black text-gray-300 px-4 py-2 rounded hover:text-white hover:border-white transition-colors cursor-pointer flex items-center gap-2">
                  <span className="text-orange-500">📂</span> Importar Backup
                  <input type="file" accept=".json" className="hidden" onChange={importJSON} />
                </label>
              </div>

              {/* Formulario de Trabajo */}
              <div className="bg-[#0a0a0a] border border-[#222] p-6 rounded-2xl">
                <form onSubmit={handleAddWork} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-500 mb-1 block">Descripción del trabajo</label>
                    <input type="text" value={workForm.name} onChange={e => setWorkForm({...workForm, name: e.target.value})} className="w-full bg-transparent border-b border-[#333] pb-2 text-white focus:outline-none focus:border-white transition-colors" required />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Fecha realizado</label>
                    <input type="date" value={workForm.date} onChange={e => setWorkForm({...workForm, date: e.target.value})} className="w-full bg-transparent border-b border-[#333] pb-2 text-gray-300 focus:outline-none focus:border-white transition-colors text-sm [color-scheme:dark]" required />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Horas totales</label>
                    <input type="number" step="0.5" value={workForm.hours} onChange={e => setWorkForm({...workForm, hours: e.target.value})} className="w-full bg-transparent border-b border-[#333] pb-2 text-white focus:outline-none focus:border-white transition-colors" required />
                  </div>
                  <div className="md:col-span-4 mt-2">
                    <button type="submit" className="w-full bg-[#1a1a1a] border border-[#333] text-white hover:border-white hover:bg-[#222] font-medium py-3 rounded-lg transition-colors text-sm">
                      Añadir a la Tabla
                    </button>
                  </div>
                </form>
              </div>

              {/* Tabla de Trabajos */}
              <div className="bg-[#0a0a0a] border border-[#222] p-6 rounded-2xl flex-1 overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-[#222]">
                      <th className="pb-3 text-gray-500 font-normal">Trabajo</th>
                      <th className="pb-3 text-gray-500 font-normal">Fecha</th>
                      <th className="pb-3 text-gray-500 font-normal">Horas</th>
                      <th className="pb-3 text-gray-500 font-normal">Subtotal</th>
                      <th className="pb-3 text-gray-500 font-normal text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {works.length === 0 ? (
                      <tr><td colSpan="5" className="py-8 text-center text-gray-600 italic">La base de datos está vacía.</td></tr>
                    ) : (
                      works.map((work) => (
                        <tr key={work.id} className="border-b border-[#111] hover:bg-[#111] transition-colors group">
                          <td className="py-4 text-gray-200">{work.name}</td>
                          <td className="py-4 text-gray-400">{work.date}</td>
                          <td className="py-4 text-gray-400">{work.hours}h</td>
                          <td className="py-4 font-medium">${(work.hours * PRICE_PER_HOUR).toLocaleString('es-AR')}</td>
                          <td className="py-4 text-center">
                            <span className={`px-3 py-1 rounded-full text-xs border ${work.isPaid ? 'bg-white text-black border-white font-medium' : 'bg-transparent text-gray-500 border-[#333]'}`}>
                              {work.isPaid ? 'Facturado / Pagado' : 'Pendiente'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            /* PESTAÑA DE FACTURAS */
            <div className="flex flex-col gap-6">
              
              <div className="bg-gradient-to-r from-[#1a1a1a] to-[#0a0a0a] border border-[#333] p-8 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                  <h3 className="text-xl font-medium text-white mb-2">Emitir Nueva Factura</h3>
                  <p className="text-sm text-gray-400">Agrupa todos los trabajos marcados como "Pendientes" y genera un documento PDF final.</p>
                </div>
                <button onClick={generateInvoice} className="bg-white text-black font-medium px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap">
                  Generar Factura de este mes
                </button>
              </div>

              {invoices.length === 0 ? (
                <div className="text-center py-16 text-gray-600 border border-[#222] rounded-2xl bg-[#0a0a0a] italic">
                  Todavía no has generado ninguna factura.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-8">
                  {invoices.map((invoice, index) => (
                    <div key={invoice.id} className="bg-white text-black p-8 md:p-10 rounded-xl print-section shadow-lg relative">
                      
                      {/* Cabecera de Factura */}
                      <div className="flex flex-col md:flex-row justify-between border-b-2 border-gray-900 pb-6 mb-6">
                        <div>
                          <h2 className="text-3xl font-black uppercase tracking-widest text-gray-900">Factura</h2>
                          <p className="text-sm text-gray-500 mt-2 font-medium">DOCUMENTO Nº {invoice.id}</p>
                        </div>
                        <div className="text-left md:text-right mt-4 md:mt-0">
                          <p className="font-medium text-gray-800">Fecha de Emisión</p>
                          <p className="text-gray-600">{invoice.date.split('-').reverse().join('/')}</p>
                          <button 
                            onClick={() => window.print()} 
                            className="mt-4 text-xs font-bold bg-black text-white px-4 py-2 rounded hover:bg-gray-800 transition-colors hide-on-print"
                          >
                            Descargar como PDF
                          </button>
                        </div>
                      </div>

                      {/* Tabla de Conceptos */}
                      <table className="w-full text-left text-sm mb-8">
                        <thead>
                          <tr className="border-b-2 border-gray-200 text-gray-800 uppercase tracking-wide text-xs">
                            <th className="py-3 font-bold">Descripción del Servicio</th>
                            <th className="py-3 font-bold">Fecha</th>
                            <th className="py-3 font-bold text-center">Horas</th>
                            <th className="py-3 font-bold text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoice.items.map(item => (
                            <tr key={item.id} className="border-b border-gray-100">
                              <td className="py-4 text-gray-800 font-medium">{item.name}</td>
                              <td className="py-4 text-gray-500">{item.date.split('-').reverse().join('/')}</td>
                              <td className="py-4 text-gray-600 text-center">{item.hours}h</td>
                              <td className="py-4 text-right text-gray-900">${(item.hours * PRICE_PER_HOUR).toLocaleString('es-AR')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Total */}
                      <div className="flex justify-end pt-4 border-t-2 border-gray-900">
                        <div className="text-right">
                          <p className="text-sm text-gray-500 font-medium uppercase tracking-widest mb-1">Total a Pagar</p>
                          <p className="text-4xl font-black text-gray-900">${invoice.amount.toLocaleString('es-AR')}</p>
                        </div>
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
      
      {/* Estilos para impresión (PDF) */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body { background: white !important; color: black !important; }
          .hide-on-print { display: none !important; }
          .print-section { border: none !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; break-inside: avoid; }
          /* Oculta la url e info que agregan los navegadores por defecto al imprimir */
          @page { margin: 0; } 
          body { padding: 2cm; }
        }
      `}} />
    </div>
  );
}
