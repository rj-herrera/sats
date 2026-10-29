import type { Group, User } from '@/types';

/**
 * In-memory copy of the company directory.
 * Repositories keep their synchronous lookups and read this after sign-in.
 * Unit tests leave it empty and keep using the local sample directory.
 */

let installed = false;
let groups: Group[] = [];
let users: User[] = [];

export function isDirectoryInstalled(): boolean {
  return installed;
}

export function installDirectory(nextGroups: Group[], nextUsers: User[]): void {
  groups = nextGroups;
  users = nextUsers;
  installed = true;
}

export function directoryGroups(): Group[] {
  return groups;
}

export function directoryUsers(): User[] {
  return users;
}

export function upsertDirectoryUser(user: User): void {
  const exists = users.some((item) => item.id === user.id);
  users = exists ? users.map((item) => (item.id === user.id ? user : item)) : [...users, user];
}
