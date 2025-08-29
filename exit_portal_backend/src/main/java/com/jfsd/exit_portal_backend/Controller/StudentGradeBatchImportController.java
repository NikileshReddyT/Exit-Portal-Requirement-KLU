package com.jfsd.exit_portal_backend.Controller;

import com.jfsd.exit_portal_backend.Service.StudentGradeBatchImportService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/grades")
@CrossOrigin(origins = {"http://127.0.0.1:5500", "http://localhost:5500", "http://localhost:5173"})
public class StudentGradeBatchImportController {

    @Autowired
    private StudentGradeBatchImportService batchImportService;

    // Step 1: Results upload (grades, credits, promotions, categories)
    @PostMapping("/results-upload")
    public ResponseEntity<List<String>> uploadResultsCsv(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "programCode", required = false) String programCode,
            @RequestParam(value = "defaultCredits", required = false) Double defaultCredits
    ) {
        try {
            List<String> messages = batchImportService.importResultsCsv(file, programCode, defaultCredits);
            return ResponseEntity.ok(messages);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(List.of("Error: " + e.getMessage()));
        }
    }

    // Step 2: Registrations upload (set academic year and semester on existing grades)
    @PostMapping("/registrations-upload")
    public ResponseEntity<List<String>> uploadRegistrationsCsv(@RequestParam("file") MultipartFile file) {
        try {
            List<String> messages = batchImportService.importRegistrationsCsv(file);
            return ResponseEntity.ok(messages);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(List.of("Error: " + e.getMessage()));
        }
    }

    // Optional admin: backfill categories for a program (useful for legacy empty categories)
    @PostMapping("/backfill-categories")
    public ResponseEntity<List<String>> backfillCategories(@RequestParam("programCode") String programCode) {
        try {
            List<String> messages = batchImportService.backfillCategories(programCode);
            return ResponseEntity.ok(messages);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(List.of("Error: " + e.getMessage()));
        }
    }
}
