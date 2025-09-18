// moved ProgramCategoryRequirementRepository injection into class body
package com.jfsd.exit_portal_backend.Service;

import com.jfsd.exit_portal_backend.Model.*;
import com.jfsd.exit_portal_backend.Repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.HashMap;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class StudentCategoryProgressService {

    private static final Logger log = LoggerFactory.getLogger(StudentCategoryProgressService.class);
    @Autowired
    private StudentCategoryProgressRepository progressRepository;
    
    @Autowired
    private StudentGradeRepository studentGradeRepository;
    
    @Autowired
    private ProgramCategoryRequirementRepository programCategoryRequirementRepository;
    
    // categoriesRepository no longer needed after SQL rewrite

    // Removed unused CoursesRepository to avoid lint warning and keep the service minimal

    @Transactional
    public void calculateAndUpdateProgressForStudents(Set<String> universityIds) {
        if (universityIds == null || universityIds.isEmpty()) {
            return;
        }

        long tStart = System.currentTimeMillis();
        log.info("Recompute(SQL): start for {} students", universityIds.size());

        // Phase 1: delete existing
        long tDelStart = System.currentTimeMillis();
        progressRepository.deleteByUniversityIdIn(universityIds);
        long tDelEnd = System.currentTimeMillis();
        log.info("Recompute(SQL): deleted existing progress for {} students in {} ms", universityIds.size(), (tDelEnd - tDelStart));

        // Phase 2: single INSERT ... SELECT to rebuild all rows
        long tInsStart = System.currentTimeMillis();
        progressRepository.insertProgressForUniversityIds(universityIds);
        long tInsEnd = System.currentTimeMillis();
        log.info("Recompute(SQL): inserted progress rows in {} ms", (tInsEnd - tInsStart));

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

    // New: Provide completion lists along with detailed metrics for incomplete students
    public Map<String, Object> getCategoryCompletionListsWithDetails(Long programId, String categoryName) {
        Map<String, Object> out = new HashMap<>();
        List<StudentCategoryProgressRepository.MetProjection> completed = getStudentsWhoMetCategory(programId, categoryName);
        List<StudentCategoryProgressRepository.MetProjection> incomplete = getStudentsWhoNotMetCategory(programId, categoryName);
        out.put("completed", completed);
        out.put("incomplete", incomplete);

        List<StudentCategoryProgressRepository.IncompleteDetailProjection> details =
                progressRepository.findIncompleteDetails(programId, categoryName);
        Map<String, Map<String, Object>> byId = new HashMap<>();
        for (StudentCategoryProgressRepository.IncompleteDetailProjection d : details) {
            int minCourses = d.getMinRequiredCourses() == null ? 0 : d.getMinRequiredCourses();
            double minCredits = d.getMinRequiredCredits() == null ? 0.0 : d.getMinRequiredCredits();
            int completedCourses = d.getCompletedCourses() == null ? 0 : d.getCompletedCourses();
            double completedCredits = d.getCompletedCredits() == null ? 0.0 : d.getCompletedCredits();
            int registeredCourses = d.getRegisteredCourses() == null ? 0 : d.getRegisteredCourses();
            double registeredCredits = d.getRegisteredCredits() == null ? 0.0 : d.getRegisteredCredits();

            int missingCourses = Math.max(0, minCourses - completedCourses);
            double missingCredits = Math.max(0.0, minCredits - completedCredits);

            Map<String, Object> m = new HashMap<>();
            m.put("minRequiredCourses", minCourses);
            m.put("minRequiredCredits", minCredits);
            m.put("completedCourses", completedCourses);
            m.put("completedCredits", completedCredits);
            m.put("registeredCourses", registeredCourses);
            m.put("registeredCredits", registeredCredits);
            m.put("missingCourses", missingCourses);
            m.put("missingCredits", missingCredits);
            m.put("studentName", d.getStudentName());
            byId.put(d.getUniversityId(), m);
        }
        out.put("incompleteDetailsById", byId);
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
