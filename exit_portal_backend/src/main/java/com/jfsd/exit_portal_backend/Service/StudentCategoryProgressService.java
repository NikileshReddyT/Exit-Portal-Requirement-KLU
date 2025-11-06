// moved ProgramCategoryRequirementRepository injection into class body
package com.jfsd.exit_portal_backend.Service;

import com.jfsd.exit_portal_backend.Model.*;
import com.jfsd.exit_portal_backend.Repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.HashMap;
import java.util.ArrayList;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.jfsd.exit_portal_backend.dto.category.CompletedStudentDetailDTO;
import com.jfsd.exit_portal_backend.dto.category.IncompleteStudentDetailDTO;
import com.jfsd.exit_portal_backend.dto.category.StudentSummaryDTO;
import com.jfsd.exit_portal_backend.dto.category.CategoryCompletionDetailsDTO;
import com.jfsd.exit_portal_backend.dto.honors.HonorsRequirementStatusDTO;
import com.jfsd.exit_portal_backend.dto.honors.StudentHonorsStatusDTO;

@Service
public class StudentCategoryProgressService {

    private static final Logger log = LoggerFactory.getLogger(StudentCategoryProgressService.class);
    @Autowired
    private StudentCategoryProgressRepository progressRepository;
    
    @Autowired
    private JdbcTemplate jdbcTemplate;
    @Autowired
    private StudentGradeRepository studentGradeRepository;
    
    @Autowired
    private ProgramCategoryRequirementRepository programCategoryRequirementRepository;

    @Autowired
    private StudentRepository studentRepository;
    
    // categoriesRepository no longer needed after SQL rewrite

    // Removed unused CoursesRepository to avoid lint warning and keep the service minimal

    @Transactional
    public void calculateAndUpdateProgressForStudents(Set<String> universityIds) {
        if (universityIds == null || universityIds.isEmpty()) return;

        long tStart = System.currentTimeMillis();
        log.info("Recompute(SQL): start for {} students", universityIds.size());

        // Stage IDs into TEMP table with PK (sql_require_primary_key safety)
        jdbcTemplate.execute("DROP TEMPORARY TABLE IF EXISTS tmp_recalc_ids");
        jdbcTemplate.execute("CREATE TEMPORARY TABLE tmp_recalc_ids (" +
                "university_id VARCHAR(64) NOT NULL PRIMARY KEY" +
                ") ENGINE=InnoDB");
        final String insIds = "INSERT INTO tmp_recalc_ids (university_id) VALUES (?)";
        jdbcTemplate.batchUpdate(insIds, universityIds.stream().toList(), universityIds.size(), (ps, id) -> ps.setString(1, id));

        // Phase 1: delete existing rows via JOIN (faster than large IN list)
        long tDelStart = System.currentTimeMillis();
        jdbcTemplate.update("DELETE scp FROM student_category_progress scp JOIN tmp_recalc_ids t ON scp.university_id = t.university_id");
        long tDelEnd = System.currentTimeMillis();
        log.info("Recompute(SQL): deleted existing progress for {} students in {} ms", universityIds.size(), (tDelEnd - tDelStart));

        // Phase 2: single INSERT ... SELECT using tmp ids in both outer and inner queries
        long tInsStart = System.currentTimeMillis();
        // Workaround MySQL limitation: can't reopen the same temp table in a subquery.
        // Duplicate the id list into a second temp table for the inner aggregate.
        jdbcTemplate.execute("DROP TEMPORARY TABLE IF EXISTS tmp_recalc_ids2");
        jdbcTemplate.execute("CREATE TEMPORARY TABLE tmp_recalc_ids2 (university_id VARCHAR(64) NOT NULL PRIMARY KEY) ENGINE=InnoDB");
        jdbcTemplate.update("INSERT INTO tmp_recalc_ids2 (university_id) SELECT university_id FROM tmp_recalc_ids");
        String insertSql =
                "INSERT INTO student_category_progress (\n" +
                "  university_id, student_name, category_name,\n" +
                "  min_required_courses, min_required_credits,\n" +
                "  completed_courses, completed_credits, category_id, program_id\n" +
                ")\n" +
                "SELECT\n" +
                "  st.student_id AS university_id,\n" +
                "  st.student_name,\n" +
                "  c.category_name AS category_name,\n" +
                "  COALESCE(pcr.min_courses, 0) AS min_required_courses,\n" +
                "  COALESCE(pcr.min_credits, 0) AS min_required_credits,\n" +
                "  COALESCE(a.completed_courses, 0)  AS completed_courses,\n" +
                "  COALESCE(a.completed_credits, 0) AS completed_credits,\n" +
                "  c.category_id,\n" +
                "  st.program_id\n" +
                "FROM students st\n" +
                "JOIN tmp_recalc_ids t ON t.university_id = st.student_id\n" +
                "JOIN categories c ON c.program_id = st.program_id\n" +
                "LEFT JOIN program_category_requirement pcr ON pcr.program_id = st.program_id AND pcr.category_id = c.category_id\n" +
                "LEFT JOIN (\n" +
                "  SELECT sg.university_id, pcc.category_id, st_inner.program_id,\n" +
                "         COUNT(*) AS completed_courses, SUM(co.course_credits) AS completed_credits\n" +
                "  FROM tmp_recalc_ids2 t2\n" +
                "  JOIN student_grades sg ON sg.university_id = t2.university_id\n" +
                "  JOIN courses co ON co.course_id = sg.course_id\n" +
                "  JOIN students st_inner ON st_inner.student_id = sg.university_id\n" +
                "  JOIN program_course_category pcc ON pcc.course_id = co.course_id AND pcc.program_id = st_inner.program_id\n" +
                "  WHERE sg.promotion = 'P'\n" +
                "  GROUP BY sg.university_id, pcc.category_id, st_inner.program_id\n" +
                ") a ON a.university_id = st.student_id AND a.category_id = c.category_id AND a.program_id = st.program_id\n" +
                "WHERE st.program_id IS NOT NULL";
        jdbcTemplate.update(insertSql);

        long tInsEnd = System.currentTimeMillis();
        log.info("Recompute(SQL): inserted progress rows in {} ms", (tInsEnd - tInsStart));

        jdbcTemplate.execute("DROP TEMPORARY TABLE IF EXISTS tmp_recalc_ids");
        jdbcTemplate.execute("DROP TEMPORARY TABLE IF EXISTS tmp_recalc_ids2");

        long tEnd = System.currentTimeMillis();
        log.info("Recompute(SQL): completed for {} students in {} ms (delete:{}ms, insert:{}ms)",
                universityIds.size(), (tEnd - tStart), (tDelEnd - tDelStart), (tInsEnd - tInsStart));

    }

    @Transactional
    public void calculateAndUpdateProgress() {
        // Fetch all unique student IDs and delegate to the specific method
        Set<String> allStudentIds = studentGradeRepository.findAllUniqueStudentIds().stream().collect(Collectors.toSet());
        calculateAndUpdateProgressForStudents(allStudentIds);
    }
    
    
    
    public List<StudentCategoryProgress> getStudentProgress(String universityId) {
        List<StudentCategoryProgress> rows = progressRepository.findByUniversityIdOrderByCategoryId(universityId);
        enrichWithMinimumsGroupedByProgram(rows);
        return rows;
    }

    public List<StudentCategoryProgress> getAllProgress() {
        List<StudentCategoryProgress> rows = progressRepository.findAll();
        enrichWithMinimumsGroupedByProgram(rows);
        return rows;
    }

    @Transactional
    public void calculateAndUpdateProgressForProgram(String programCode) {
        // Fetch all unique student IDs for the specific program and delegate
        Set<String> programStudentIds = studentGradeRepository.findStudentIdsByProgramCode(programCode).stream().collect(Collectors.toSet());
        calculateAndUpdateProgressForStudents(programStudentIds);
    }

    public StudentHonorsStatusDTO getStudentHonorsStatus(String universityId) {
        return buildStudentHonorsStatus(universityId, null);
    }

    public StudentHonorsStatusDTO buildStudentHonorsStatus(String universityId, List<StudentCategoryProgress> existingProgressRows) {
        if (universityId == null || universityId.isBlank()) {
            return null;
        }

        Student student = studentRepository.findByStudentId(universityId).orElse(null);
        if (student == null) {
            return null;
        }

        boolean hasFailure = student.isHasAnyFailure();
        Program program = student.getProgram();
        List<ProgramCategoryRequirement> honorsRequirements;
        if (program != null && program.getProgramId() != null) {
            honorsRequirements = programCategoryRequirementRepository.findHonorsRequirementsByProgramId(program.getProgramId());
        } else {
            honorsRequirements = java.util.Collections.emptyList();
        }

        List<StudentCategoryProgress> progressRows = existingProgressRows;
        if (progressRows == null) {
            progressRows = progressRepository.findByUniversityIdOrderByCategoryId(universityId);
        }
        Map<String, StudentCategoryProgress> progressByCategory = progressRows.stream()
                .filter(row -> row.getCategoryName() != null)
                .collect(Collectors.toMap(StudentCategoryProgress::getCategoryName, Function.identity(), (a, b) -> a));

        List<HonorsRequirementStatusDTO> statuses = new ArrayList<>();
        boolean meetsHonorsCredits = true;
        if (!honorsRequirements.isEmpty()) {
            for (ProgramCategoryRequirement requirement : honorsRequirements) {
                String categoryName = requirement.getCategory() != null ? requirement.getCategory().getCategoryName() : null;
                if (categoryName == null || categoryName.isBlank()) {
                    continue;
                }
                double requiredCredits = requirement.getHonorsMinCredits() == null ? 0.0 : requirement.getHonorsMinCredits();
                StudentCategoryProgress progress = progressByCategory.get(categoryName);
                double completedCredits = (progress != null && progress.getCompletedCredits() != null) ? progress.getCompletedCredits() : 0.0;
                boolean met = completedCredits + 1e-6 >= requiredCredits;
                if (!met) {
                    meetsHonorsCredits = false;
                }
                statuses.add(new HonorsRequirementStatusDTO(categoryName, requiredCredits, completedCredits, met));
            }
        }

        boolean eligible = !hasFailure && meetsHonorsCredits;
        StudentHonorsStatusDTO dto = new StudentHonorsStatusDTO();
        dto.setStudentId(student.getStudentId());
        dto.setStudentName(student.getStudentName());
        dto.setHasAnyFailure(hasFailure);
        dto.setEligible(eligible);
        dto.setCategoryStatuses(statuses);
        return dto;
    }

    public List<StudentCategoryProgress> getStudentProgressForProgram(String universityId, String programCode) {
        List<StudentCategoryProgress> rows = progressRepository.findByUniversityIdAndProgramCode(universityId, programCode);
        enrichWithMinimumsForProgram(rows, programCode);
        return rows;
    }

    public List<StudentCategoryProgress> getAllProgressForProgram(String programCode) {
        List<StudentCategoryProgress> rows = progressRepository.findByProgramCode(programCode);
        enrichWithMinimumsForProgram(rows, programCode);
        return rows;
    }

    // ===== Category completion lists (completed vs incomplete) =====
    public List<StudentCategoryProgressRepository.MetProjection> getStudentsWhoMetCategory(Long programId, String categoryName) {
        return progressRepository.findStudentsWhoMetCategory(programId, categoryName);
    }

    public List<StudentCategoryProgressRepository.MetProjection> getStudentsWhoNotMetCategory(Long programId, String categoryName) {
        return progressRepository.findStudentsWhoNotMetCategory(programId, categoryName);
    }

    public Map<String, List<StudentCategoryProgressRepository.MetProjection>> getCategoryCompletionLists(Long programId, String categoryName) {
        Map<String, List<StudentCategoryProgressRepository.MetProjection>> result = new HashMap<>();
        result.put("completed", getStudentsWhoMetCategory(programId, categoryName));
        result.put("incomplete", getStudentsWhoNotMetCategory(programId, categoryName));
        return result;
    }

    // New: Provide completion lists along with detailed metrics for incomplete and completed students
    public CategoryCompletionDetailsDTO getCategoryCompletionListsWithDetails(Long programId, String categoryName) {
        // Summaries
        List<StudentSummaryDTO> completedSummaries = getStudentsWhoMetCategory(programId, categoryName)
                .stream()
                .map(p -> new StudentSummaryDTO(p.getUniversityId(), p.getStudentName()))
                .collect(Collectors.toList());
        List<StudentSummaryDTO> incompleteSummaries = getStudentsWhoNotMetCategory(programId, categoryName)
                .stream()
                .map(p -> new StudentSummaryDTO(p.getUniversityId(), p.getStudentName()))
                .collect(Collectors.toList());

        // Incomplete details map
        List<StudentCategoryProgressRepository.IncompleteDetailProjection> incRows =
                progressRepository.findIncompleteDetails(programId, categoryName);
        Map<String, IncompleteStudentDetailDTO> incompleteDetailsById = new HashMap<>();
        for (StudentCategoryProgressRepository.IncompleteDetailProjection d : incRows) {
            int minCourses = d.getMinRequiredCourses() == null ? 0 : d.getMinRequiredCourses();
            double minCredits = d.getMinRequiredCredits() == null ? 0.0 : d.getMinRequiredCredits();
            int cCourses = d.getCompletedCourses() == null ? 0 : d.getCompletedCourses();
            double cCredits = d.getCompletedCredits() == null ? 0.0 : d.getCompletedCredits();
            int rCourses = d.getRegisteredCourses() == null ? 0 : d.getRegisteredCourses();
            double rCredits = d.getRegisteredCredits() == null ? 0.0 : d.getRegisteredCredits();
            int missingCourses = Math.max(0, minCourses - cCourses);
            double missingCredits = Math.max(0.0, minCredits - cCredits);

            IncompleteStudentDetailDTO dto = new IncompleteStudentDetailDTO(
                    minCourses, minCredits, cCourses, cCredits, rCourses, rCredits, missingCourses, missingCredits
            );
            incompleteDetailsById.put(d.getUniversityId(), dto);
        }

        // Completed details map
        List<StudentCategoryProgressRepository.CompletedDetailProjection> compRows =
                progressRepository.findCompletedDetails(programId, categoryName);
        Map<String, CompletedStudentDetailDTO> completedDetailsById = new HashMap<>();
        for (StudentCategoryProgressRepository.CompletedDetailProjection d : compRows) {
            int cCourses = d.getCompletedCourses() == null ? 0 : d.getCompletedCourses();
            double cCredits = d.getCompletedCredits() == null ? 0.0 : d.getCompletedCredits();
            completedDetailsById.put(d.getUniversityId(), new CompletedStudentDetailDTO(cCourses, cCredits));
        }

        CategoryCompletionDetailsDTO out = new CategoryCompletionDetailsDTO();
        out.setCompleted(completedSummaries);
        out.setIncomplete(incompleteSummaries);
        out.setIncompleteDetailsById(incompleteDetailsById);
        out.setCompletedDetailsById(completedDetailsById);
        // Category-level minimums
        StudentCategoryProgressRepository.CategoryMinProjection min =
                progressRepository.findCategoryMinimums(programId, categoryName);
        if (min != null) {
            Integer cminCourses = min.getMinRequiredCourses();
            Double cminCredits = min.getMinRequiredCredits();
            out.setCategoryMinRequiredCourses(cminCourses == null ? 0 : cminCourses);
            out.setCategoryMinRequiredCredits(cminCredits == null ? 0.0 : cminCredits);
        } else {
            out.setCategoryMinRequiredCourses(0);
            out.setCategoryMinRequiredCredits(0.0);
        }
        return out;
    }

    // Projected: treat registered as completed for determining completion
    public CategoryCompletionDetailsDTO getCategoryCompletionListsWithDetailsProjected(Long programId, String categoryName) {
        // Base data
        List<StudentSummaryDTO> completedSummaries = getStudentsWhoMetCategory(programId, categoryName)
                .stream()
                .map(p -> new StudentSummaryDTO(p.getUniversityId(), p.getStudentName()))
                .collect(Collectors.toList());
        List<StudentSummaryDTO> incompleteSummaries = getStudentsWhoNotMetCategory(programId, categoryName)
                .stream()
                .map(p -> new StudentSummaryDTO(p.getUniversityId(), p.getStudentName()))
                .collect(Collectors.toList());

        // Incomplete details include registered metrics
        List<StudentCategoryProgressRepository.IncompleteDetailProjection> incRows =
                progressRepository.findIncompleteDetails(programId, categoryName);
        Map<String, IncompleteStudentDetailDTO> incompleteDetailsById = new HashMap<>();
        Set<String> projectedIds = new java.util.HashSet<>();
        for (StudentCategoryProgressRepository.IncompleteDetailProjection d : incRows) {
            int minCourses = d.getMinRequiredCourses() == null ? 0 : d.getMinRequiredCourses();
            double minCredits = d.getMinRequiredCredits() == null ? 0.0 : d.getMinRequiredCredits();
            int cCourses = d.getCompletedCourses() == null ? 0 : d.getCompletedCourses();
            double cCredits = d.getCompletedCredits() == null ? 0.0 : d.getCompletedCredits();
            int rCourses = d.getRegisteredCourses() == null ? 0 : d.getRegisteredCourses();
            double rCredits = d.getRegisteredCredits() == null ? 0.0 : d.getRegisteredCredits();
            int missingCourses = Math.max(0, minCourses - cCourses);
            double missingCredits = Math.max(0.0, minCredits - cCredits);

            IncompleteStudentDetailDTO dto = new IncompleteStudentDetailDTO(
                    minCourses, minCredits, cCourses, cCredits, rCourses, rCredits, missingCourses, missingCredits
            );
            incompleteDetailsById.put(d.getUniversityId(), dto);

            boolean coursesOk = (minCourses <= 0) || (cCourses + rCourses) >= minCourses;
            boolean creditsOk = (minCredits <= 0.0) || (cCredits + rCredits) >= minCredits;
            if (coursesOk && creditsOk) {
                projectedIds.add(d.getUniversityId());
            }
        }

        // Completed details (actual)
        List<StudentCategoryProgressRepository.CompletedDetailProjection> compRows =
                progressRepository.findCompletedDetails(programId, categoryName);
        Map<String, CompletedStudentDetailDTO> completedDetailsById = new HashMap<>();
        for (StudentCategoryProgressRepository.CompletedDetailProjection d : compRows) {
            int cCourses = d.getCompletedCourses() == null ? 0 : d.getCompletedCourses();
            double cCredits = d.getCompletedCredits() == null ? 0.0 : d.getCompletedCredits();
            completedDetailsById.put(d.getUniversityId(), new CompletedStudentDetailDTO(cCourses, cCredits));
        }

        // Build projected completed list: union(actual completed + projectedIds from incomplete)
        Map<String, String> nameById = new HashMap<>();
        for (StudentSummaryDTO s : completedSummaries) nameById.put(s.getUniversityId(), s.getStudentName());
        for (StudentSummaryDTO s : incompleteSummaries) nameById.putIfAbsent(s.getUniversityId(), s.getStudentName());

        List<StudentSummaryDTO> projectedCompleted = new java.util.ArrayList<>(completedSummaries);
        for (String pid : projectedIds) {
            if (nameById.containsKey(pid)) {
                projectedCompleted.add(new StudentSummaryDTO(pid, nameById.get(pid)));
            }
        }

        // Remaining incomplete: those not in projected set
        java.util.Set<String> projectedSet = new java.util.HashSet<>();
        for (StudentSummaryDTO s : completedSummaries) projectedSet.add(s.getUniversityId());
        projectedSet.addAll(projectedIds);
        List<StudentSummaryDTO> remainingIncomplete = incompleteSummaries.stream()
                .filter(s -> !projectedSet.contains(s.getUniversityId()))
                .collect(Collectors.toList());

        // Category-level minimums
        StudentCategoryProgressRepository.CategoryMinProjection min =
                progressRepository.findCategoryMinimums(programId, categoryName);

        java.util.Map<String, Boolean> projectedById = new java.util.HashMap<>();
        for (StudentSummaryDTO s : projectedCompleted) {
            boolean proj = projectedIds.contains(s.getUniversityId()) && !completedDetailsById.containsKey(s.getUniversityId());
            if (proj) projectedById.put(s.getUniversityId(), true);
        }

        CategoryCompletionDetailsDTO out = new CategoryCompletionDetailsDTO();
        out.setCompleted(projectedCompleted);
        out.setIncomplete(remainingIncomplete);
        out.setIncompleteDetailsById(incompleteDetailsById);
        out.setCompletedDetailsById(completedDetailsById);
        if (min != null) {
            Integer cminCourses = min.getMinRequiredCourses();
            Double cminCredits = min.getMinRequiredCredits();
            out.setCategoryMinRequiredCourses(cminCourses == null ? 0 : cminCourses);
            out.setCategoryMinRequiredCredits(cminCredits == null ? 0.0 : cminCredits);
        } else {
            out.setCategoryMinRequiredCourses(0);
            out.setCategoryMinRequiredCredits(0.0);
        }
        out.setProjectedById(projectedById);
        return out;
    }

    // Helper: group rows by program code and enrich from ProgramCategoryRequirement
    private void enrichWithMinimumsGroupedByProgram(List<StudentCategoryProgress> rows) {
        if (rows == null || rows.isEmpty()) return;
        Map<String, List<StudentCategoryProgress>> byProgram = rows.stream()
                .collect(Collectors.groupingBy(scp -> scp.getProgram() != null ? scp.getProgram().getCode() : null));
        for (Map.Entry<String, List<StudentCategoryProgress>> e : byProgram.entrySet()) {
            String programCode = e.getKey();
            if (programCode == null) continue; // cannot derive minimums without program
            enrichWithMinimumsForProgram(e.getValue(), programCode);
        }
    }

    // Helper: load all PCR for a program once and apply to matching category names
    private void enrichWithMinimumsForProgram(List<StudentCategoryProgress> rows, String programCode) {
        if (rows == null || rows.isEmpty() || programCode == null) return;
        List<ProgramCategoryRequirement> reqs = programCategoryRequirementRepository.findByProgramCode(programCode);
        Map<String, ProgramCategoryRequirement> reqByCategoryName = reqs.stream()
                .filter(r -> r.getCategory() != null && r.getCategory().getCategoryName() != null)
                .collect(Collectors.toMap(r -> r.getCategory().getCategoryName(), Function.identity(), (a,b)->a));
        for (StudentCategoryProgress scp : rows) {
            String catName = scp.getCategoryName();
            ProgramCategoryRequirement r = reqByCategoryName.get(catName);
            if (r != null) {
                scp.setMinRequiredCourses(r.getMinCourses());
                scp.setMinRequiredCredits(r.getMinCredits());
            }
        }
    }
}
