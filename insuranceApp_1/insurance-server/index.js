const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const app = express();
const port = 5001;

const SECRET_KEY = 'your_jwt_secret_key_1'; // Use a strong secret key

const BASE_URL = 'http://10.2.1.148:6001';

// Function to record a claim
async function recordClaim(imei) {
  try {
    const response = await axios.post(`${BASE_URL}/recordClaim`, { imei });
    console.log('Transaction successful:', response.data);
  } catch (error) {
    console.error('Error recording claim:', error.response ? error.response.data : error.message);
  }
}

// Function to check if an IMEI is claimed
async function isClaimed(imei) {
  try {
    const response = await axios.get(`${BASE_URL}/isClaimed/${imei}`);
    return response.data.claimed;
  } catch (error) {
    console.error('Error checking claim status:', error.response ? error.response.data : error.message);
  }
}


app.use(cors());
app.use(express.json());

// Create or open the SQLite database
let db = new sqlite3.Database('./insurances.db', (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Connected to the insurances database.');
});

// Create the tables if they don't exist
db.run(`CREATE TABLE IF NOT EXISTS insurance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  imei TEXT NOT NULL,
  status TEXT DEFAULT NULL,
  comments TEXT
)`);

db.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user'
)`);

// Register a new user
app.post('/api/register', async (req, res) => {
  const { email, password, role } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  const sql = 'INSERT INTO users (email, password, role) VALUES (?, ?, ?)';
  const params = [email, hashedPassword, role || 'user'];

  db.run(sql, params, function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.status(201).json({ id: this.lastID, email, role: role || 'user' });
  });
});

// Login a user
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const sql = 'SELECT * FROM users WHERE email = ?';

  db.get(sql, [email], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, SECRET_KEY, { expiresIn: '1h' });
    res.json({ token });
  });
});

// Middleware to authenticate requests
const authenticate = (req, res, next) => {
  const token = req.header('Authorization').replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Please authenticate' });
  }
};

// Get all insurances (authenticated)
app.get('/api/insurances', authenticate, (req, res) => {
  const sql = 'SELECT * FROM insurance';
  db.all(sql, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Add a new insurance (authenticated)
app.post('/api/insurances', authenticate, (req, res) => {
  const { name, address, imei, comments } = req.body;
  const sql = 'INSERT INTO insurance (name, address, imei, comments) VALUES (?, ?, ?, ?)';
  const params = [name, address, imei, comments];

  db.run(sql, params, function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.status(201).json({ id: this.lastID, ...req.body, status: null });
  });
});

// Apply a claim (authenticated)
app.post('/api/applyClaim', authenticate, (req, res) => {
  const { imei, comments } = req.body;
  const sql = 'UPDATE insurance SET status = ?, comments = ? WHERE imei = ?';
  const params = ["pending", comments, imei];

  db.run(sql, params, function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.status(201).json({ id: this.lastID, ...req.body, status: null });
  });
});

// Record a claim and update the database to set status to pending (authenticated)
app.post('/api/claim', authenticate, async (req, res) => {
  const { imei, comments } = req.body;
  if (!imei) {
    return res.status(400).send({ error: 'IMEI is required' });
  }

  try {
    // Record the claim on the blockchain
    const tx = await contract.recordClaim(imei);
    await tx.wait();

    // Update the status to pending in the database
    const sql = 'UPDATE insurance SET status = ?, comments = ? WHERE imei = ?';
    const params = ['pending', comments, imei];

    db.run(sql, params, function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ message: 'Insurance not found' });
      }
      res.json({ imei, status: 'pending', comments, tx });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin endpoint to update insurance status to accepted or rejected (authenticated)
app.post('/api/updateStatus', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }

  const { imei, status, comments } = req.body;
  if (!imei || !['accepted', 'rejected'].includes(status)) {
    return res.status(400).send({ error: 'Invalid status or IMEI' });
  }

  const sql = 'UPDATE insurance SET status = ?, comments = ? WHERE imei = ?';
  const params = [status, comments, imei];

  if (status === "accepted") {
    // Record the claim on the blockchain
    await recordClaim(imei);
  }

  db.run(sql, params, function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: 'Insurance not found' });
    }
    res.json({ imei, status, comments });
  });
});

// API endpoint to check if an IMEI is claimed (authenticated)
app.get('/isClaimed/:imei', authenticate, async (req, res) => {
  const { imei } = req.params;
  if (!imei) {
    return res.status(400).send({ error: 'IMEI is required' });
  }

  try {
    const claimed = await isClaimed(imei);
    res.send({ claimed });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// Close the database connection on exit
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Closed the database connection.');
    process.exit(0);
  });
});

app.listen(port,"0.0.0.0", () => {
  console.log(`Server running on http://10.2.1.148:${port}`);
});
