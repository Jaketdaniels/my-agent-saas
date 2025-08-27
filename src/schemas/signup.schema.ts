import { z } from "zod"
import { catchaSchema } from "./catcha.schema";

// Common weak passwords to block
const WEAK_PASSWORDS = [
  'password', '12345678', '123456789', 'qwerty', 'abc123', 
  'password123', 'admin', 'letmein', 'welcome', 'monkey',
  '1234567890', 'qwertyuiop', 'password1', 'password!', '123123'
];

// Password validation with strength requirements
const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters long")
  .max(100, "Password must be less than 100 characters")
  .refine((password) => {
    // Check for at least one uppercase letter
    return /[A-Z]/.test(password);
  }, "Password must contain at least one uppercase letter")
  .refine((password) => {
    // Check for at least one lowercase letter
    return /[a-z]/.test(password);
  }, "Password must contain at least one lowercase letter")
  .refine((password) => {
    // Check for at least one number
    return /[0-9]/.test(password);
  }, "Password must contain at least one number")
  .refine((password) => {
    // Check it's not a common weak password
    return !WEAK_PASSWORDS.includes(password.toLowerCase());
  }, "This password is too common. Please choose a stronger password");

export const signUpSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  firstName: z.string().min(2).max(255).trim(),
  lastName: z.string().min(2).max(255).trim(),
  password: passwordSchema,
  captchaToken: catchaSchema,
})

export type SignUpSchema = z.infer<typeof signUpSchema>
