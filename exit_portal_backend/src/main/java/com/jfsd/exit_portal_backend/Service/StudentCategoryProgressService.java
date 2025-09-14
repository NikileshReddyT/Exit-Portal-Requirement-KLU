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
        List<StudentCategoryProgress> rows = progressRepository.findByUniversityId(universityId);
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
