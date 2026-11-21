import http from 'http';
import dotenv from 'dotenv';
import app from './src/app.js';
import { Server } from 'socket.io';
import connectDB from './src/config/db.js';
import Issue from './src/models/issue.model.js';
dotenv.config();
connectDB();

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*'
  },
});

// Make the Socket.IO instance available to REST controllers via req.app.get('socketio').
// (This must be set before requests are handled, not registered as late middleware.)
app.set('socketio', io);

io.on('connection', (socket) => {
  console.log('A client connected:', socket.id);

  socket.join('developers-room');// Join a room for developers
  socket.on('issue_status_changed',async ({ issueId, status})=>{
    try {
      const issue = await Issue.findByIdAndUpdate(issueId, { status }, { new: true });
      if (issue) {
        // Broadcast change to everyone in the room
        io.to('developers-room').emit('issue_status_changed', {
          issueId: issue._id,
          status: issue.status,
        });
      }
    } catch (err) {
      console.error('Socket status update error:', err);
    }
  })



  socket.on('disconnect', () => {
    console.log('A client disconnected:', socket.id);
  })
});

const PORT = process.env.PORT || 2000;

server.listen(PORT,()=>{
    console.log(`Server is running on port ${PORT}`);
})