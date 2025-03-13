import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const SECRET_KEY = process.env.JWT_SECRET || "my_super_secret_key";

export function authenticate(req, res, next) {
  const token = req.header("Authorization");
  if (!token) return res.status(401).json({ message: "Access denied" });

  try {
    const decoded = jwt.verify(token.replace("Bearer ", ""), SECRET_KEY);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(403).json({ message: "Invalid token" });
  }
}

export function authorize(roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Permission denied" });
    }
    next();
  };
}
