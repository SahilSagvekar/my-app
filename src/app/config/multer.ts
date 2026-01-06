import multer from "multer";
// import logger from "../config/logger.js";

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

// logger.info("Multer configured with memory storage");

export default upload;
