export class AppError extends Error {
  public code: string;

  constructor(message: string, code: string = 'INTERNAL_ERROR') {
    super(message);
    this.name = 'AppError';
    this.code = code;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Sesi Anda telah habis atau Anda belum login.') {
    super(message, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Anda tidak memiliki akses ke halaman atau aksi ini.') {
    super(message, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Data tidak ditemukan.') {
    super(message, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends AppError {
  public field?: string;

  constructor(message: string, field?: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.field = field;
  }
}

export class InsufficientStockError extends AppError {
  public productName: string;

  constructor(productName: string) {
    super(`Stok untuk produk ${productName} tidak mencukupi.`, 'INSUFFICIENT_STOCK');
    this.name = 'InsufficientStockError';
    this.productName = productName;
  }
}

export class InvalidTransitionError extends AppError {
  public from: string;
  public to: string;

  constructor(from: string, to: string) {
    super(`Tidak dapat mengubah status pesanan dari ${from} ke ${to}.`, 'INVALID_TRANSITION');
    this.name = 'InvalidTransitionError';
    this.from = from;
    this.to = to;
  }
}

/**
 * Someone else saved the same block first.
 *
 * Every CMS block carries a version, and saving is a conditional UPDATE on the
 * version the editor loaded. Zero rows affected means the text on screen is no
 * longer the text in the database, so the edit is refused rather than allowed
 * to overwrite work the editor never saw. The current value travels with the
 * error so the browser can show what it lost the race to.
 */
export class StaleContentError extends AppError {
  public current: string;

  constructor(current: string) {
    super('Blok ini baru saja diubah orang lain. Cek versi terbarunya dulu ya.', 'STALE_CONTENT');
    this.name = 'StaleContentError';
    this.current = current;
  }
}
