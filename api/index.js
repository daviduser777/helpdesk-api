const { MongoClient, ObjectId } = require('mongodb');

// Conexión a MongoDB (reutiliza la conexión)
let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
    if (cachedDb) return cachedDb;
    
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    cachedDb = client.db('helpdesk');
    return cachedDb;
}

// Manejador principal de Vercel
module.exports = async (req, res) => {
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Responder a preflight (OPTIONS)
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    try {
        const db = await connectToDatabase();
        const url = req.url;
        
        // ============================================
        // HEALTH CHECK
        // ============================================
        if (req.method === 'GET' && url === '/health') {
            return res.status(200).json({ 
                status: 'OK', 
                service: 'HelpDesk API',
                timestamp: new Date().toISOString()
            });
        }
        
        // ============================================
        // GET /tickets - Listar todos
        // ============================================
        if (req.method === 'GET' && url === '/tickets') {
            const tickets = await db.collection('tickets').find({}).toArray();
            return res.status(200).json({ 
                success: true, 
                count: tickets.length,
                data: tickets 
            });
        }
        
        // ============================================
        // GET /tickets/:id - Obtener uno
        // ============================================
        if (req.method === 'GET' && url.startsWith('/tickets/')) {
            const id = url.split('/')[2];
            if (!ObjectId.isValid(id)) {
                return res.status(400).json({ success: false, error: 'ID inválido' });
            }
            const ticket = await db.collection('tickets').findOne({ _id: new ObjectId(id) });
            if (!ticket) {
                return res.status(404).json({ success: false, error: 'Ticket no encontrado' });
            }
            return res.status(200).json({ success: true, data: ticket });
        }
        
        // ============================================
        // POST /tickets - Crear ticket
        // ============================================
        if (req.method === 'POST' && url === '/tickets') {
            const { titulo, descripcion, prioridad, email_usuario } = req.body;
            
            // Validaciones
            if (!titulo || !descripcion || !email_usuario) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Faltan campos: titulo, descripcion, email_usuario son obligatorios' 
                });
            }
            
            const newTicket = {
                titulo,
                descripcion,
                prioridad: prioridad || 'normal',
                email_usuario,
                estado: 'abierto',
                fecha_creacion: new Date(),
                fecha_actualizacion: new Date()
            };
            
            const result = await db.collection('tickets').insertOne(newTicket);
            
            return res.status(201).json({ 
                success: true, 
                message: 'Ticket creado exitosamente',
                data: { ...newTicket, _id: result.insertedId }
            });
        }
        
        // ============================================
        // PUT /tickets/:id - Actualizar ticket
        // ============================================
        if (req.method === 'PUT' && url.startsWith('/tickets/')) {
            const id = url.split('/')[2];
            if (!ObjectId.isValid(id)) {
                return res.status(400).json({ success: false, error: 'ID inválido' });
            }
            
            const { estado, prioridad } = req.body;
            const updateData = { fecha_actualizacion: new Date() };
            if (estado) updateData.estado = estado;
            if (prioridad) updateData.prioridad = prioridad;
            
            const result = await db.collection('tickets').updateOne(
                { _id: new ObjectId(id) },
                { $set: updateData }
            );
            
            if (result.matchedCount === 0) {
                return res.status(404).json({ success: false, error: 'Ticket no encontrado' });
            }
            
            return res.status(200).json({ success: true, message: 'Ticket actualizado correctamente' });
        }
        
        // ============================================
        // DELETE /tickets/:id - Eliminar ticket
        // ============================================
        if (req.method === 'DELETE' && url.startsWith('/tickets/')) {
            const id = url.split('/')[2];
            if (!ObjectId.isValid(id)) {
                return res.status(400).json({ success: false, error: 'ID inválido' });
            }
            
            const result = await db.collection('tickets').deleteOne({ _id: new ObjectId(id) });
            
            if (result.deletedCount === 0) {
                return res.status(404).json({ success: false, error: 'Ticket no encontrado' });
            }
            
            return res.status(200).json({ success: true, message: 'Ticket eliminado correctamente' });
        }
        
        // Si llegamos aquí, el endpoint no existe
        return res.status(404).json({ error: 'Endpoint no encontrado' });
        
    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Error interno del servidor',
            details: error.message 
        });
    }
};