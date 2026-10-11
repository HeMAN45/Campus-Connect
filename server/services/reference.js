import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

const dir = path.join(config.root, 'seed', 'reference');
const load = (file) => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));

export const reference = {
  departments: load('departments.json'),
  programs: load('programs.json'),
  designations: load('designations.json'),
  subjectTags: load('subject-tags.json'),
  mentorTopics: load('mentor-topics.json'),
};

export const findProgram = (name) => reference.programs.find((p) => p.name === name);

// Academic year starts in July.
export const academicStartYear = (d = new Date()) => (d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1);

export function graduationYear(programName, year) {
  const length = findProgram(programName)?.years || 4;
  return academicStartYear() + (length - year) + 1;
}

export function admissionYear(programName, gradYear) {
  const length = findProgram(programName)?.years || 4;
  return gradYear - length;
}
