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
  process.env.FRONTEND_URL,
].filter(Boolean);

// CORS configuration
const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // allow server-to-server/tools

    // allow request from main domain for both dev and prod
    if (FRONTEND_URLS.includes(origin)) return cb(null, true);

    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const domain = process.env.DOMAIN_NAME;

    // allow subdomain request for both dev and prod
    const subdomainRgx = new RegExp(`^${protocol}://[a-z0-9-]+\\.${domain.replace(/\./g, '\\.')}$`, 'i');

    if (subdomainRgx.test(origin)) {
      return cb(null, true);
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
