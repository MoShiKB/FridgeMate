export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password: string): boolean => {
  return password.length >= 6;
};

export const validateFullName = (fullName: string): boolean => {
  return fullName.trim().length > 0;
};

export const getEmailError = (email: string): string | null => {
  if (!email.trim()) {
    return 'Please enter email';
  }
  if (!validateEmail(email)) {
    return 'Please enter a valid email';
  }
  return null;
};

export const getPasswordError = (password: string): string | null => {
  if (!password.trim()) {
    return 'Please enter password';
  }
  if (!validatePassword(password)) {
    return 'Password must be at least 6 characters';
  }
  return null;
};

export const getFullNameError = (fullName: string): string | null => {
  if (!fullName.trim()) {
    return 'Please enter full name';
  }
  return null;
};

export const getPasswordConfirmError = (password: string, confirmPassword: string): string | null => {
  if (!confirmPassword.trim()) {
    return 'Please confirm password';
  }
  if (password !== confirmPassword) {
    return 'Passwords do not match';
  }
  return null;
};
