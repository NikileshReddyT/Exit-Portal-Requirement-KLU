package com.jfsd.exit_portal_backend.Controller;

import com.jfsd.exit_portal_backend.Model.StudentGrade;
import com.jfsd.exit_portal_backend.Service.StudentGradeService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/grades")
@CrossOrigin(origins = "http://127.0.0.1:5500")
public class StudentGradeController {

    @Autowired
    private StudentGradeService studentGradeService;

    // Upload CSV file
    @PostMapping("/upload")
    public ResponseEntity<List<String>> uploadFile(@RequestParam("file") MultipartFile file) {
        try {
            List<String> messages = studentGradeService.uploadCSV(file);
            return ResponseEntity.ok(messages);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(List.of("Error processing file: " + e.getMessage()));
        }
    }

    // Get all grades
    @GetMapping
    public ResponseEntity<List<StudentGrade>> getAllGrades() {
        return ResponseEntity.ok(studentGradeService.getAllGrades());
    }

    // Get grades by university ID
    @GetMapping("/student/{universityId}")
    public ResponseEntity<List<StudentGrade>> getGradesByUniversityId(@PathVariable String universityId) {
        return ResponseEntity.ok(studentGradeService.getGradesByUniversityId(universityId));
    }

    // Get grade by ID
    @GetMapping("/{id}")
    public ResponseEntity<StudentGrade> getGradeById(@PathVariable Long id) {
        Optional<StudentGrade> grade = studentGradeService.getGradeById(id);
        return grade.map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    // Create new grade
    @PostMapping
    public ResponseEntity<StudentGrade> createGrade(@RequestBody StudentGrade grade) {
        return ResponseEntity.ok(studentGradeService.saveGrade(grade));
    }

    // Update grade
    @PutMapping("/{id}")
    public ResponseEntity<StudentGrade> updateGrade(@PathVariable Long id, @RequestBody StudentGrade gradeDetails) {
        StudentGrade updatedGrade = studentGradeService.updateGrade(id, gradeDetails);
        if (updatedGrade != null) {
            return ResponseEntity.ok(updatedGrade);
        }
        return ResponseEntity.notFound().build();
    }

    // Delete grade
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteGrade(@PathVariable Long id) {
        try {
            studentGradeService.deleteGrade(id);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Error deleting grade: " + e.getMessage());
        }
    }
}