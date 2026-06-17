export class DuplicateEmailError extends Error {
  constructor(message = "Email already exists") {
    super(message);
    this.name = "DuplicateEmailError";
  }
}

export class DuplicateSlugError extends Error {
  constructor(message = "Slug already exists") {
    super(message);
    this.name = "DuplicateSlugError";
  }
}

export class DuplicateOrganizationMembershipError extends Error {
  constructor(message = "User is already a member of this organization") {
    super(message);
    this.name = "DuplicateOrganizationMembershipError";
  }
}
