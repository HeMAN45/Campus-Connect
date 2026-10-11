import departments from '../seed/reference/departments.json' with { type: 'json' };
import programs from '../seed/reference/programs.json' with { type: 'json' };
import designations from '../seed/reference/designations.json' with { type: 'json' };
import subjectTags from '../seed/reference/subject-tags.json' with { type: 'json' };
import mentorTopics from '../seed/reference/mentor-topics.json' with { type: 'json' };

export const reference = {
  departments,
  programs,
  designations,
  subjectTags,
  mentorTopics,
};

export const findProgram = (name) => reference.programs.find((p) => p.name === name);

export const academicStartYear = (d = new Date()) => (d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1);

export function graduationYear(programName, year) {
  const length = findProgram(programName)?.years || 4;
  return academicStartYear() + (length - year) + 1;
}

export function admissionYear(programName, gradYear) {
  const length = findProgram(programName)?.years || 4;
  return gradYear - length;
}
