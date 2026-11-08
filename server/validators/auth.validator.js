import { EMAIL_RE, PASSWORD } from '../config/constants.js';

export const isEmail = email => typeof email === 'string' && EMAIL_RE.test(email) && email.length <= 254;
export const isPassword = password => typeof password === 'string' && password.length >= PASSWORD.min && password.length <= PASSWORD.max;
export const isResetToken = token => typeof token === 'string' && /^[A-Za-z0-9_-]{20,100}$/.test(token);
export const PASSWORD_RULE = `Password must be ${PASSWORD.min} to ${PASSWORD.max} characters`;
