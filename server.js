require("dotenv").config();

const express = require("express");
const cookieParser = require('cookie-parser');

const authRoutes = require("./routes/authRoutes");
const templateRoutes = require("./routes/templateRoutes");
const eventRoutes = require("./routes/eventRoutes");
const websiteRoutes = require("./routes/websiteRoutes");

const connectDB = require("./config/db");
const cors = require("cors");
const morgan = require("morgan");

const app = express();

connectDB();

app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

const FRONTEND_URLS = [
  (process.env.FRONTEND_URL || '').replace(/\/$/, ''), // e.g. https://temporary-event.vercel.app
  'http://localhost:5173',
  'http://tempevents.local:3000',
].filter(Boolean);

// CORS configuration
const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // allow server-to-server/tools
    
    const normalized = origin.replace(/\/$/, '');
    if (FRONTEND_URLS.includes(normalized)) return cb(null, true);

    // Allow local viewer subdomains like http://{sub}.tempevents.local:3000
    const localViewerRgx = /^http:\/\/[a-z0-9-]+\.tempevents\.local:3000$/i;
    if (localViewerRgx.test(normalized)) return cb(null, true);

    const DOMAIN_NAME = process.env.DOMAIN_NAME;
    if (DOMAIN_NAME) {
      const subdomainRgx = new RegExp(`^https://[a-z0-9-]+\\.${DOMAIN_NAME.replace(/\./g, '\\.')}$`, 'i');
      if (subdomainRgx.test(normalized)) return cb(null, true);
    }

    return cb(new Error('CORS blocked'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // handle preflight

const PORT = process.env.PORT || 5000;

app.get("/test", (_, res) => {
  res.status(200).json({
    success: true,
    message: "App is working fine! Good to go!"
  });
});

app.use("/auth", authRoutes);
app.use("/template", templateRoutes);
app.use("/event", eventRoutes);
app.use("/website", websiteRoutes);

app.listen(PORT, () => {
  console.log(`API server is running properly✅`);
});

// backend is hosted on localhost:5000
// localhost mapping is written in 'hosts' file
// no cross-origin means the request comes from the same origin where the backend is hosted
// for eg:
//          backend is hosted on the domain api.tempevents.local:5000
//          frontend sends request from same domain like http://api.tempevents.local:5000/test
// cross-origin means the request comes from different origin from where the backend is hosted
// for eg:
//          backend is hosted on the domain api.tempevents.local:5000
//          frontend sends request from same domain like http://tempevents.local:3000/test (cross-origin)
// the origin is defined by protocol, domain and port, if one of these don't match with where the backend host, its treated as cross-origin
// and the CORS needs to be configured accordingly!!!