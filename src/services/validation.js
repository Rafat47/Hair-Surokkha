// Checks customer details at checkout.
// Name and address must be text. Phone must be 9 to 14 digits.

const PHONE_REGEX = /^\d{9,14}$/;

function validateCustomer(input = {}) {
  const errors = {};

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const phone = typeof input.phone === 'string' || typeof input.phone === 'number'
    ? String(input.phone).trim()
    : '';
  const address = typeof input.address === 'string' ? input.address.trim() : '';

  if (!name) {
    errors.name = 'Name is required';
  }

  if (!PHONE_REGEX.test(phone)) {
    errors.phone = 'Phone number must be 9 to 14 digits';
  }

  if (!address) {
    errors.address = 'Address is required';
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    data: { name, phone, address }
  };
}

module.exports = { validateCustomer };