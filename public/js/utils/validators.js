export function isValidEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

export function isValidPassword(password) {
  const minLength = /.{8,}/;
  const upper = /[A-Z]/;
  const lower = /[a-z]/;
  const number = /[0-9]/;
  const special = /[!@#$%^&*(),.?":{}|<>-_]/;

  return (
    minLength.test(password) &&
    upper.test(password) &&
    lower.test(password) &&
    number.test(password) &&
    special.test(password)
  );
}