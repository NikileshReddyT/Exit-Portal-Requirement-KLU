package com.jfsd.exit_portal_backend.Service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminMaintenanceService {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    /**
     * Deletes all data for a program by program code or program name.
     * If both are provided, code takes precedence. Throws IllegalArgumentException if no program is found.
     */
    @Transactional
    public String deleteProgramCascade(String programCode, String programName) {
        Long programId = resolveProgramId(programCode, programName);
        if (programId == null) {
            throw new IllegalArgumentException("Program not found for provided code/name");
        }
        return performCascadeDeletion(programId);
    }

    @Transactional
    public String deleteProgramCascadeById(Long programId) {
        if (programId == null) {
            throw new IllegalArgumentException("Program ID is required");
        }
        return performCascadeDeletion(programId);
    }

    private String performCascadeDeletion(Long programId) {
        // Execute the deletion steps in child-to-parent order.
        // 1) student_category_progress by program_id
        jdbcTemplate.update("DELETE FROM student_category_progress WHERE program_id = ?", programId);

        // 2) student_grades by students in program
        jdbcTemplate.update(
            "DELETE FROM student_grades WHERE university_id IN (SELECT student_id FROM students WHERE program_id = ?)",
            programId
        );

        // 3) students by program_id
        jdbcTemplate.update("DELETE FROM students WHERE program_id = ?", programId);

        // 4) program_course_category by program_id
        jdbcTemplate.update("DELETE FROM program_course_category WHERE program_id = ?", programId);

        // 5) program_category_requirement by program_id
        jdbcTemplate.update("DELETE FROM program_category_requirement WHERE program_id = ?", programId);

        // 6) remove orphan courses that are not mapped to any program anymore
        jdbcTemplate.update(
            "DELETE FROM courses WHERE course_id NOT IN (SELECT DISTINCT course_id FROM program_course_category)"
        );

        // 7) categories by program_id
        jdbcTemplate.update("DELETE FROM categories WHERE program_id = ?", programId);

        return "Successfully deleted program " + programId + " and all related records";
    }

    private Long resolveProgramId(String programCode, String programName) {
        try {
            if (programCode != null && !programCode.isBlank()) {
                return jdbcTemplate.queryForObject(
                    "SELECT program_id FROM programs WHERE code = ?",
                    Long.class,
                    programCode
                );
            }
        } catch (Exception ignored) {}

        try {
            if (programName != null && !programName.isBlank()) {
                return jdbcTemplate.queryForObject(
                    "SELECT program_id FROM programs WHERE name = ?",
                    Long.class,
                    programName
                );
            }
        } catch (Exception ignored) {}

        return null;
    }
}
