import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  redact: {
    paths: [
      "password",
      "token",
      "refreshToken",
      "email",
      "phoneNumber",
      "contactEmail",
      "contactPhone",
      "*.password",
      "*.token",
      "*.refreshToken",
      "*.email",
      "*.phoneNumber",
      "*.contactEmail",
      "*.contactPhone",
      "*.*.password",
      "*.*.token",
      "*.*.refreshToken",
      "*.*.email",
      "*.*.phoneNumber",
      "*.*.contactEmail",
      "*.*.contactPhone",
      "*.*.*.password",
      "*.*.*.token",
      "*.*.*.refreshToken",
      "*.*.*.email",
      "*.*.*.phoneNumber",
      "*.*.*.contactEmail",
      "*.*.*.contactPhone",
      "*.*.*.*.password",
      "*.*.*.*.token",
      "*.*.*.*.refreshToken",
      "*.*.*.*.email",
      "*.*.*.*.phoneNumber",
      "*.*.*.*.contactEmail",
      "*.*.*.*.contactPhone"
    ],
    censor: "[REDACTED]"
  },
  transport: !isProduction
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          ignore: "pid,hostname"
        }
      }
    : undefined
});

export default logger;
