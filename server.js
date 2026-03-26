const http = require('http');
const fs = require('fs');
const path = require('path');

const hostname = '0.0.0.0';
const port = process.env.PORT || 3000;

// sample in-memory data
let pets = [
  { id: 1, name: 'Fido', species: 'dog' },
  { id: 2, name: 'Mittens', species: 'cat' },
];
let appointments = [];
let nextPetId = pets.length + 1;
let nextApptId = 1;

// helper to send JSON
function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

// serve static file from public directory
function serveStatic(res, file) {
  const filePath = path.join(__dirname, 'public', file);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.statusCode = 404;
      res.end('Not Found');
      return;
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html' : 'text/plain');
    res.end(data);
  });
}

// parse request body JSON
function parseBody(req, callback) {
  let body = '';
  req.on('data', chunk => (body += chunk));
  req.on('end', () => {
    try {
      callback(null, JSON.parse(body || '{}'));
    } catch (err) {
      callback(err);
    }
  });
}

const server = http.createServer((req, res) => {
  const { method, url } = req;
  if (method === 'GET' && (url === '/' || url === '/index.html')) {
    return serveStatic(res, 'index.html');
  }
  if (method === 'GET' && (url === '/vet' || url === '/vet.html')) {
    return serveStatic(res, 'vet.html');
  }

  if (method === 'GET' && url === '/pets') {
    return sendJson(res, 200, pets);
  }
  if (method === 'POST' && url === '/pets') {
    return parseBody(req, (err, data) => {
      if (err || !data.name || !data.species) {
        return sendJson(res, 400, { error: 'Invalid' });
      }
      const pet = { id: nextPetId++, name: data.name, species: data.species };
      pets.push(pet);
      return sendJson(res, 201, pet);
    });
  }
  const petMatch = url.match(/^\/pets\/(\d+)$/);
  if (method === 'GET' && petMatch) {
    const id = parseInt(petMatch[1], 10);
    const pet = pets.find(p => p.id === id);
    if (!pet) return sendJson(res, 404, { error: 'Not Found' });
    return sendJson(res, 200, pet);
  }
  if (method === 'GET' && url === '/appointments') {
    return sendJson(res, 200, appointments);
  }
  if (method === 'POST' && url === '/appointments') {
    return parseBody(req, (err, data) => {
      if (err || !data.petId || !data.scheduledDate) {
        return sendJson(res, 400, { error: 'Invalid' });
      }
      const appt = { id: nextApptId++, petId: parseInt(data.petId,10), scheduledDate: data.scheduledDate };
      appointments.push(appt);
      return sendJson(res, 201, appt);
    });
  }
  res.statusCode = 404;
  res.end('Not Found');
});

server.listen(port, hostname, () => {
  console.log(`Server running on ${hostname}:${port}`);
});
