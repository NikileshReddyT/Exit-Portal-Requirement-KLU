// Controller
package com.jfsd.exit_portal_backend.Controller;

import com.jfsd.exit_portal_backend.Model.StudentCategoryProgress;
import com.jfsd.exit_portal_backend.Service.StudentCategoryProgressService;
import com.jfsd.exit_portal_backend.Repository.StudentCategoryProgressRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/progress")
@CrossOrigin(origins = {"http://localhost:3000", "http://localhost:5173"}, allowCredentials = "true")
public class StudentCategoryProgressController {

    @Autowired
    private StudentCategoryProgressService progressService;

    @GetMapping("/run")
    public ResponseEntity<String> calculateProgress(
            @RequestParam(value = "programCode", required = false) String programCode) {
        try {
            if (programCode != null) {
                progressService.calculateAndUpdateProgressForProgram(programCode);
            } else {
                progressService.calculateAndUpdateProgress();
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
    // If details=true, also include per-student metrics for incomplete students (missing/registered)
    @GetMapping("/category/completion")
    public ResponseEntity<Map<String, ?>> getCategoryCompletion(
            @RequestParam("categoryName") String categoryName,
            @RequestParam(value = "programId", required = false) Long programId,
            @RequestParam(value = "details", required = false, defaultValue = "false") boolean details
    ) {
        if (details) {
            Map<String, Object> result = progressService.getCategoryCompletionListsWithDetails(programId, categoryName);
            return ResponseEntity.ok(result);
        } else {
            Map<String, List<StudentCategoryProgressRepository.MetProjection>> result = progressService.getCategoryCompletionLists(programId, categoryName);
            return ResponseEntity.ok(result);
        }
    }
}