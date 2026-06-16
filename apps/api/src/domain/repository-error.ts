export class DuplicateEmailError extends Error {
  constructor(message = "Email already exists") {
    super(message);
    this.name = "DuplicateEmailError";
  }
}
