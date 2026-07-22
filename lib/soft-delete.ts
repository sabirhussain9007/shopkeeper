/** Match active records whether deletedAt is missing or explicitly null. */
export const notDeletedFilter = {
  $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
};

export function isRecordDeleted(record: { deletedAt?: string | Date | null }) {
  return Boolean(record.deletedAt);
}

export function activeRecords<T extends { deletedAt?: string | Date | null }>(records: T[]) {
  return records.filter((record) => !isRecordDeleted(record));
}
