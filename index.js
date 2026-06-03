// Cargar variables de entorno
require('dotenv').config();
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const axios = require('axios');

// Crear la aplicación Express
const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());           // Permite peticiones desde cualquier origen
app.use(express.json());   // Parsear JSON automáticamente

// Variable global para la conexión a MongoDB
let db;

// Función para conectar a MongoDB
async function connectToMongo() {
    try {
        const client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        db = client.db('helpdesk');  // Base de datos 'helpdesk'
        console.log('✅ Conectado a MongoDB Atlas');
    } catch (error) {
        console.error('❌ Error conectando a MongoDB:', error);
        process.exit(1);
    }
}

// ============================================
// ENDPOINTS DE LA API
// ============================================

// 1. GET /tickets - Listar todos los tickets
app.get('/tickets', async (req, res) => {
    try {
        const tickets = await db.collection('tickets').find({}).toArray();
        res.json({
            success: true,
            count: tickets.length,
            data: tickets
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2. GET /tickets/:id - Obtener un ticket específico
app.get('/tickets/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const ticket = await db.collection('tickets').findOne({ _id: new ObjectId(id) });
        
        if (!ticket) {
            return res.status(404).json({ success: false, error: 'Ticket no encontrado' });
        }
        
        res.json({ success: true, data: ticket });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 3. POST /tickets - Crear un nuevo ticket
app.post('/tickets', async (req, res) => {
    try {
        const { titulo, descripcion, prioridad, email_usuario } = req.body;
        
        // Validar datos requeridos
        if (!titulo || !descripcion || !email_usuario) {
            return res.status(400).json({
                success: false,
                error: 'Faltan campos: titulo, descripcion, email_usuario son obligatorios'
            });
        }
        
        // Crear el ticket
        const newTicket = {
            titulo,
            descripcion,
            prioridad: prioridad || 'normal',  // normal, alta, urgente
            email_usuario,
            estado: 'abierto',                  // abierto, en_proceso, cerrado
            fecha_creacion: new Date(),
            fecha_actualizacion: new Date()
        };
        
        const result = await db.collection('tickets').insertOne(newTicket);
        
        // Obtener el ticket con su ID
        const ticketCreado = { ...newTicket, _id: result.insertedId };
        
        // ============================================
        // INTEGRACIÓN CON TRELLO (para tickets URGENTES)
        // ============================================
        if (prioridad === 'urgente') {
            try {
                // Necesitas configurar estas variables de entorno más tarde
                const trelloKey = process.env.TRELLO_API_KEY;
                const trelloToken = process.env.TRELLO_TOKEN;
                const trelloBoardId = process.env.TRELLO_BOARD_ID;
                
                if (trelloKey && trelloToken && trelloBoardId) {
                    // Crear tarjeta en Trello
                    const trelloUrl = `https://api.trello.com/1/cards`;
                    const trelloResponse = await axios.post(trelloUrl, null, {
                        params: {
                            key: trelloKey,
                            token: trelloToken,
                            idList: trelloBoardId,  // ID de la lista "Por hacer"
                            name: `[URGENTE] ${titulo}`,
                            desc: `Ticket de soporte urgente\n\nUsuario: ${email_usuario}\nDescripción: ${descripcion}\n\nID Ticket: ${result.insertedId}`,
                            due: null
                        }
                    });
                    
                    ticketCreado.trello_card_url = trelloResponse.data.url;
                    console.log('✅ Tarjeta creada en Trello:', trelloResponse.data.url);
                }
            } catch (trelloError) {
                console.error('⚠️ No se pudo crear tarjeta en Trello:', trelloError.message);
                // No falla la creación del ticket si Trello falla
            }
        }
        
        res.status(201).json({
            success: true,
            message: 'Ticket creado exitosamente',
            data: ticketCreado
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 4. PUT /tickets/:id - Actualizar un ticket
app.put('/tickets/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const { estado, prioridad, respuesta } = req.body;
        
        const updateData = {
            fecha_actualizacion: new Date()
        };
        
        if (estado) updateData.estado = estado;
        if (prioridad) updateData.prioridad = prioridad;
        if (respuesta) updateData.respuesta = respuesta;
        
        const result = await db.collection('tickets').updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );
        
        if (result.matchedCount === 0) {
            return res.status(404).json({ success: false, error: 'Ticket no encontrado' });
        }
        
        res.json({
            success: true,
            message: 'Ticket actualizado correctamente'
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 5. DELETE /tickets/:id - Eliminar un ticket
app.delete('/tickets/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const result = await db.collection('tickets').deleteOne({ _id: new ObjectId(id) });
        
        if (result.deletedCount === 0) {
            return res.status(404).json({ success: false, error: 'Ticket no encontrado' });
        }
        
        res.json({
            success: true,
            message: 'Ticket eliminado correctamente'
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 6. GET /health - Verificar que el servidor está vivo
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date(),
        service: 'HelpDesk API'
    });
});

// ============================================
// INICIAR EL SERVIDOR
// ============================================
async function startServer() {
    await connectToMongo();
    
    app.listen(PORT, () => {
        console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
        console.log(`📋 Endpoints disponibles:`);
        console.log(`   GET    /tickets`);
        console.log(`   GET    /tickets/:id`);
        console.log(`   POST   /tickets`);
        console.log(`   PUT    /tickets/:id`);
        console.log(`   DELETE /tickets/:id`);
        console.log(`   GET    /health`);
    });
}

startServer();