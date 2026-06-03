const { MongoClient, ObjectId } = require('mongodb');
const axios = require('axios');

let cachedDb = null;

async function connectToDatabase() {
    if (cachedDb) return cachedDb;
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    cachedDb = client.db('helpdesk');
    return cachedDb;
}

// ============================================
// FUNCIÓN PARA CREAR TARJETA EN TRELLO
// ============================================
async function createTrelloCard(ticketData, ticketId) {
    // Obtener las variables de entorno
    const trelloKey = process.env.TRELLO_API_KEY;
    const trelloToken = process.env.TRELLO_TOKEN;
    const trelloListId = process.env.TRELLO_LIST_ID;
    
    // Verificar que existan las variables
    if (!trelloKey || !trelloToken || !trelloListId) {
        console.log('⚠️ Trello no configurado. Faltan variables:', {
            key: !!trelloKey,
            token: !!trelloToken,
            listId: !!trelloListId
        });
        return null;
    }
    
    // Crear el contenido de la tarjeta
    const cardTitle = `[URGENTE] ${ticketData.titulo}`;
    const cardDescription = `
**Ticket de Soporte Urgente**

**ID del ticket:** ${ticketId}
**Usuario:** ${ticketData.email_usuario}
**Prioridad:** ${ticketData.prioridad}

**Descripción:**
${ticketData.descripcion}

**Fecha:** ${new Date().toLocaleString()}

---
Creado automáticamente desde Help Desk API
    `.trim();
    
    try {
        console.log('📨 Intentando crear tarjeta en Trello...');
        const response = await axios.post('https://api.trello.com/1/cards', null, {
            params: {
                key: trelloKey,
                token: trelloToken,
                idList: trelloListId,
                name: cardTitle,
                desc: cardDescription,
                pos: 'top'
            }
        });
        
        console.log('✅ Tarjeta creada:', response.data.url);
        return response.data.url;
    } catch (error) {
        console.error('❌ Error creando tarjeta Trello:', error.response?.data || error.message);
        return null;
    }
}

// ============================================
// MANEJADOR PRINCIPAL
// ============================================
module.exports = async (req, res) => {
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
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
        // POST /tickets - Crear ticket (CON TRELLO)
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
            
            // Guardar en MongoDB
            const result = await db.collection('tickets').insertOne(newTicket);
            const ticketCreado = { ...newTicket, _id: result.insertedId };
            
            // ============================================
            // 🌟 SI ES URGENTE, CREAR TARJETA EN TRELLO
            // ============================================
            let trelloCardUrl = null;
            if (prioridad === 'urgente') {
                console.log('🔥 Ticket urgente detectado. Creando tarjeta en Trello...');
                trelloCardUrl = await createTrelloCard(newTicket, result.insertedId);
            } else {
                console.log('ℹ️ Ticket no urgente. No se crea tarjeta en Trello.');
            }
            
            return res.status(201).json({ 
                success: true, 
                message: 'Ticket creado exitosamente',
                data: ticketCreado,
                trello_card_url: trelloCardUrl
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