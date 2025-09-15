package com.jfsd.exit_portal_backend.Controller;

import com.jfsd.exit_portal_backend.Service.NaturalLanguageQueryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/analytics")
@CrossOrigin(origins = {"http://localhost:3000", "http://localhost:5173"}, allowCredentials = "true")
public class AnalyticsController {

    @Autowired
    private NaturalLanguageQueryService nlQueryService;

    @PostMapping("/query")
    public ResponseEntity<Map<String, Object>> executeNaturalLanguageQuery(@RequestBody Map<String, String> request) {
        try {
            String query = request.get("query");
            if (query == null || query.trim().isEmpty()) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "Query parameter is required");
                return ResponseEntity.badRequest().body(error);
            }

            Map<String, Object> result = nlQueryService.processNaturalLanguageQuery(query.trim());
            return ResponseEntity.ok(result);

        } catch (SecurityException e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "Security violation: " + e.getMessage());
            error.put("type", "security");
            return ResponseEntity.badRequest().body(error);

        } catch (IllegalStateException e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", e.getMessage());
            error.put("type", "quota");
            return ResponseEntity.status(429).body(error);

        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "Failed to process query: " + e.getMessage());
            error.put("type", "processing");
            return ResponseEntity.internalServerError().body(error);
        }
    }

    @GetMapping("/schema")
    public ResponseEntity<Map<String, Object>> getSchemaInfo() {
        Map<String, Object> schema = new HashMap<>();
        
        Map<String, Object> tables = new HashMap<>();
        
        tables.put("programs", Map.of(
            "columns", Map.of(
                "program_id", "BIGINT PRIMARY KEY",
                "code", "VARCHAR(20) UNIQUE",
                "name", "VARCHAR(100)"
            ),
            "description", "Academic programs"
        ));
        
        tables.put("students", Map.of(
            "columns", Map.of(
                "student_id", "VARCHAR(64) PRIMARY KEY", 
                "student_name", "VARCHAR",
                "password", "VARCHAR",
                "program_id", "BIGINT FK->programs.program_id"
            ),
            "description", "Student records"
        ));
        
        tables.put("categories", Map.of(
            "columns", Map.of(
                "categoryID", "INT PRIMARY KEY",
                "category_name", "VARCHAR",
                "program_id", "BIGINT FK->programs.program_id"
            ),
            "description", "Course categories per program"
        ));
        
        tables.put("courses", Map.of(
            "columns", Map.of(
                "courseID", "INT PRIMARY KEY",
                "course_code", "VARCHAR UNIQUE",
                "course_title", "VARCHAR", 
                "course_credits", "DOUBLE"
            ),
            "description", "Course catalog"
        ));
        
        tables.put("student_grades", Map.of(
            "columns", Map.of(
                "sno", "BIGINT PRIMARY KEY",
                "university_id", "VARCHAR FK->students.student_id",
                "course_id", "INT FK->courses.courseID",
                "grade", "VARCHAR",
                "grade_point", "DOUBLE",
                "promotion", "VARCHAR (P/F)",
                "category", "VARCHAR",
                "academic_year", "VARCHAR",
                "semester", "VARCHAR"
            ),
            "description", "Student academic performance"
        ));
        
        tables.put("program_course_category", Map.of(
            "columns", Map.of(
                "id", "BIGINT PRIMARY KEY",
                "program_id", "BIGINT FK->programs.program_id",
                "course_id", "INT FK->courses.courseID", 
                "category_id", "INT FK->categories.categoryID"
            ),
            "description", "Maps courses to categories per program"
        ));
        
        tables.put("program_category_requirement", Map.of(
            "columns", Map.of(
                "id", "BIGINT PRIMARY KEY",
                "program_id", "BIGINT FK->programs.program_id",
                "category_id", "INT FK->categories.categoryID",
                "min_courses", "INT",
                "min_credits", "DOUBLE"
            ),
            "description", "Minimum requirements per program-category"
        ));
        
        schema.put("tables", tables);
        schema.put("relationships", Map.of(
            "students_programs", "students.program_id -> programs.program_id",
            "categories_programs", "categories.program_id -> programs.program_id", 
            "grades_students", "student_grades.university_id -> students.student_id",
            "grades_courses", "student_grades.course_id -> courses.courseID",
            "mappings", "program_course_category links programs, courses, categories",
            "requirements", "program_category_requirement defines minimums per program-category"
        ));
        
        return ResponseEntity.ok(schema);
    }
}
