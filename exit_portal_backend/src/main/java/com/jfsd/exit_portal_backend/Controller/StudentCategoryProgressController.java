// Controller
package com.jfsd.exit_portal_backend.Controller;

import com.jfsd.exit_portal_backend.Model.StudentCategoryProgress;
import com.jfsd.exit_portal_backend.Service.StudentCategoryProgressService;
import com.jfsd.exit_portal_backend.Repository.StudentCategoryProgressRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.CacheManager;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import com.jfsd.exit_portal_backend.dto.category.CategoryCompletionDetailsDTO;

@RestController
@RequestMapping("/api/progress")
@CrossOrigin(origins = {"http://localhost:3000", "http://localhost:5173"}, allowCredentials = "true")
public class StudentCategoryProgressController {

    @Autowired
    private StudentCategoryProgressService progressService;

    @Autowired
    private CacheManager cacheManager;

    @GetMapping("/run")
    public ResponseEntity<String> calculateProgress(
            @RequestParam(value = "programCode", required = false) String programCode) {
        try {
            if (programCode != null) {
                progressService.calculateAndUpdateProgressForProgram(programCode);
            } else {
                progressService.calculateAndUpdateProgress();
            }
            if (cacheManager != null && cacheManager.getCache("admin_api") != null) {
                cacheManager.getCache("admin_api").clear();
            }
            return ResponseEntity.ok("Progress calculation completed successfully");
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body("Error calculating progress: " + e.getMessage());
        }
    }

    @GetMapping("/student/{universityId}")
    public ResponseEntity<List<StudentCategoryProgress>> getStudentProgress(
            @PathVariable String universityId,
            @RequestParam(value = "programCode", required = false) String programCode) {
        if (programCode != null) {
            return ResponseEntity.ok(progressService.getStudentProgressForProgram(universityId, programCode));
        }
        return ResponseEntity.ok(progressService.getStudentProgress(universityId));
    }

    @GetMapping("/all")
    public ResponseEntity<List<StudentCategoryProgress>> getAllProgress(
            @RequestParam(value = "programCode", required = false) String programCode) {
        if (programCode != null) {
            return ResponseEntity.ok(progressService.getAllProgressForProgram(programCode));
        }
        return ResponseEntity.ok(progressService.getAllProgress());
    }

    // Completed vs Incomplete students for a category (optional program scope via programId)
    // If details=true, also include per-student metrics for incomplete (missing/registered) and completed (completed metrics)
    @GetMapping("/category/completion")
    public ResponseEntity<?> getCategoryCompletion(
            @RequestParam("categoryName") String categoryName,
            @RequestParam(value = "programId", required = false) Long programId,
            @RequestParam(value = "details", required = false, defaultValue = "false") boolean details,
            @RequestParam(value = "project", required = false, defaultValue = "false") boolean project
    ) {
        if (details) {
            CategoryCompletionDetailsDTO dto = project
                    ? progressService.getCategoryCompletionListsWithDetailsProjected(programId, categoryName)
                    : progressService.getCategoryCompletionListsWithDetails(programId, categoryName);
            return ResponseEntity.ok(dto);
        } else {
            Map<String, List<StudentCategoryProgressRepository.MetProjection>> result = progressService.getCategoryCompletionLists(programId, categoryName);
            return ResponseEntity.ok(result);
        }
    }
}