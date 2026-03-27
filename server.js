/*
 * Minimal Veterinary CRM server built with Node's built‑in HTTP module.
 * This implementation demonstrates key endpoints for pets and appointments
 * without any external dependencies.  It uses in‑memory arrays to store
 * data and supports GET and POST operations via JSON.  For a real system
 * you would replace these in‑memory stores with a database.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const hostname = '0.0.0.0';
const port = 3000;

// In‑memory data stores
// In this updated demo we support a rudimentary data model for owners,
// pets, vaccinations, medications and appointments. These objects live
// entirely in memory. In a real system you would back them with a
// persistent datastore.

// Owners: represents pet owners. Each owner has an id, name, email and
// optional phone number. Owner ids are used to relate pets to owners.
let owners = [
  { id: 1, name: 'Jane Doe', email: 'jane@example.com', phone: '555-1234' },
  { id: 2, name: 'John Smith', email: 'john@example.com', phone: '555-5678' },
];
let nextOwnerId = owners.length + 1;

// Pets: each pet has an id, name, species/breed, and an array of ownerIds
// representing a multi‑owner household. Vaccinations and medications are
// arrays of objects defined below.
let pets = [
  {
    id: 1,
    name: 'Fido',
    species: 'dog',
    breed: 'Golden Retriever',
    ownerIds: [1],
    vaccinations: [
      { id: 1, type: 'Rabies', date: '2025-01-01', dueDate: '2026-01-01' },
    ],
    medications: [],
  },
  {
    id: 2,
    name: 'Mittens',
    species: 'cat',
    breed: 'Domestic Shorthair',
    ownerIds: [2],
    vaccinations: [],
    medications: [],
  },
];
let nextPetId = pets.length + 1;

// Appointments: each appointment references a petId and includes a date
// (ISO 8601 string) and optional reason/notes. Appointment ids increment
// automatically.
let appointments = [];
let nextAppointmentId = 1;

function sendJSON(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

// Serve a static HTML file from the public directory. If the file is not found
// respond with a 404. Only used for very simple UI demonstration. This server
// does not implement caching or advanced MIME detection. For production you
// would use a dedicated static file server or framework.
function serveFile(res, filePath, contentType = 'text/html') {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Not Found');
      return;
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    res.end(data);
  });
}

function parseBody(req, callback) {
  let body = '';
  req.on('data', chunk => {
    body += chunk;
  });
  req.on('end', () => {
    try {
      const data = JSON.parse(body || '{}');
      callback(null, data);
    } catch (err) {
      callback(err);
    }
  });
}

const server = http.createServer((req, res) => {
  const { method, url } = req;
  // Basic static routing for demo UI. Check before API routes so that
  // '/pets' still returns JSON.
  if (method === 'GET' && (url === '/' || url === '/index.html')) {
    return serveFile(res, path.join(__dirname, 'public', 'index.html'), 'text/html');
  }
  if (method === 'GET' && (url === '/vet' || url === '/vet.html')) {
    return serveFile(res, path.join(__dirname, 'public', 'vet.html'), 'text/html');
  }
  // Route: GET /pets
  if (method === 'GET' && url === '/pets') {
    return sendJSON(res, 200, pets);
  }
  // Route: POST /pets (create new pet) – simple example for vet side.
  if (method === 'POST' && url === '/pets') {
    parseBody(req, (err, data) => {
      if (err) return sendJSON(res, 400, { error: 'Invalid JSON' });
      const { name, species, breed, ownerIds } = data;
      if (!name || !species) {
        return sendJSON(res, 400, { error: 'Missing required fields: name and species' });
      }
      // Convert ownerIds to an array of integers if provided as comma separated string
      let ownerIdList = [];
      if (Array.isArray(ownerIds)) {
        ownerIdList = ownerIds.map(id => parseInt(id, 10)).filter(id => owners.some(o => o.id === id));
      } else if (typeof ownerIds === 'string') {
        ownerIdList = ownerIds.split(',').map(s => parseInt(s.trim(), 10)).filter(id => owners.some(o => o.id === id));
      }
      const newPet = {
        id: nextPetId++,
        name: String(name),
        species: String(species),
        breed: breed ? String(breed) : '',
        ownerIds: ownerIdList,
        vaccinations: [],
        medications: [],
      };
      pets.push(newPet);
      return sendJSON(res, 201, newPet);
    });
    return;
  }
  // Route: GET /pets/:id
  const petMatch = url.match(/^\/pets\/(\d+)$/);
  if (method === 'GET' && petMatch) {
    const id = parseInt(petMatch[1], 10);
    const pet = pets.find(p => p.id === id);
    if (!pet) return sendJSON(res, 404, { error: 'Pet not found' });
    // Include resolved owner objects for convenience
    const resolvedOwners = pet.ownerIds.map(id => owners.find(o => o.id === id)).filter(Boolean);
    return sendJSON(res, 200, { ...pet, owners: resolvedOwners });
  }
  // Route: GET /owners
  if (method === 'GET' && url === '/owners') {
    return sendJSON(res, 200, owners);
  }
  // Route: POST /owners (create new owner)
  if (method === 'POST' && url === '/owners') {
    parseBody(req, (err, data) => {
      if (err) return sendJSON(res, 400, { error: 'Invalid JSON' });
      const { name, email, phone } = data;
      if (!name || !email) return sendJSON(res, 400, { error: 'Missing required fields: name and email' });
      const newOwner = { id: nextOwnerId++, name: String(name), email: String(email), phone: phone ? String(phone) : '' };
      owners.push(newOwner);
      return sendJSON(res, 201, newOwner);
    });
    return;
  }
  // Route: GET /pets/:id/vaccinations
  const vacMatch = url.match(/^\/pets\/(\d+)\/vaccinations$/);
  if (method === 'GET' && vacMatch) {
    const petId = parseInt(vacMatch[1], 10);
    const pet = pets.find(p => p.id === petId);
    if (!pet) return sendJSON(res, 404, { error: 'Pet not found' });
    return sendJSON(res, 200, pet.vaccinations);
  }
  // Route: POST /pets/:id/vaccinations
  if (method === 'POST' && vacMatch) {
    const petId = parseInt(vacMatch[1], 10);
    const pet = pets.find(p => p.id === petId);
    if (!pet) return sendJSON(res, 404, { error: 'Pet not found' });
    parseBody(req, (err, data) => {
      if (err) return sendJSON(res, 400, { error: 'Invalid JSON' });
      const { type, date, dueDate } = data;
      if (!type || !date) return sendJSON(res, 400, { error: 'Missing required fields: type and date' });
      const newVac = { id: pet.vaccinations.length + 1, type: String(type), date: String(date), dueDate: dueDate ? String(dueDate) : '' };
      pet.vaccinations.push(newVac);
      return sendJSON(res, 201, newVac);
    });
    return;
  }
  // Route: GET /pets/:id/medications
  const medMatch = url.match(/^\/pets\/(\d+)\/medications$/);
  if (method === 'GET' && medMatch) {
    const petId = parseInt(medMatch[1], 10);
    const pet = pets.find(p => p.id === petId);
    if (!pet) return sendJSON(res, 404, { error: 'Pet not found' });
    return sendJSON(res, 200, pet.medications);
  }
  // Route: POST /pets/:id/medications
  if (method === 'POST' && medMatch) {
    const petId = parseInt(medMatch[1], 10);
    const pet = pets.find(p => p.id === petId);
    if (!pet) return sendJSON(res, 404, { error: 'Pet not found' });
    parseBody(req, (err, data) => {
      if (err) return sendJSON(res, 400, { error: 'Invalid JSON' });
      const { name, dosage, startDate, endDate } = data;
      if (!name || !dosage) return sendJSON(res, 400, { error: 'Missing required fields: name and dosage' });
      const newMed = {
        id: pet.medications.length + 1,
        name: String(name),
        dosage: String(dosage),
        startDate: startDate ? String(startDate) : '',
        endDate: endDate ? String(endDate) : '',
      };
      pet.medications.push(newMed);
      return sendJSON(res, 201, newMed);
    });
    return;
  }
  // Route: GET /appointments
  if (method === 'GET' && url === '/appointments') {
    return sendJSON(res, 200, appointments);
  }
  // Route: POST /appointments
  if (method === 'POST' && url === '/appointments') {
    parseBody(req, (err, data) => {
      if (err) return sendJSON(res, 400, { error: 'Invalid JSON' });
      const { petId, scheduledDate, reason } = data;
      if (!petId || !scheduledDate) {
        return sendJSON(res, 400, { error: 'Missing required fields: petId and scheduledDate' });
      }
      const pet = pets.find(p => p.id === parseInt(petId, 10));
      if (!pet) return sendJSON(res, 404, { error: 'Pet not found' });
      const newAppointment = {
        id: nextAppointmentId++,
        petId: parseInt(petId, 10),
        scheduledDate: String(scheduledDate),
        reason: reason ? String(reason) : '',
      };
      appointments.push(newAppointment);
      return sendJSON(res, 201, newAppointment);
    });
    return;
  }
  // Not found
  sendJSON(res, 404, { error: 'Not found' });
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});