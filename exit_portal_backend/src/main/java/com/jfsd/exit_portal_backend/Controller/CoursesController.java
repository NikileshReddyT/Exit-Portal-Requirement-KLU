package com.jfsd.exit_portal_backend.Controller;

import com.jfsd.exit_portal_backend.Model.Courses;
import com.jfsd.exit_portal_backend.Service.CoursesService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

// import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/api/courses")
@CrossOrigin
public class CoursesController {

    @Autowired
    private CoursesService coursesService;

    @GetMapping
    public List<Courses> getAllCourses() {
        return coursesService.getAllCourses();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Courses> getCourseById(@PathVariable int id) {
        Courses course = coursesService.getCourseById(id);
        return course != null ? ResponseEntity.ok(course) : ResponseEntity.notFound().build();
    }

    @PostMapping("/upload")
    public ResponseEntity<List<String>> uploadFile(@RequestParam("file") MultipartFile file) {
        try {
            List<String> messages = coursesService.populateCoursesFromCSV(file);
            return ResponseEntity.ok(messages);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(List.of("Error processing file: " + e.getMessage()));
        }
    }




    //   @PostMapping("/coursecredits")
    // public ResponseEntity<String> populateCourseCredits(@RequestParam("file") MultipartFile file) {
    //     if (file.isEmpty()) {
    //         return ResponseEntity.badRequest().body("Please select a CSV file to upload.");
    //     }

    //     try {
    //         coursesService.addCourseCredits(file);
    //         return ResponseEntity.ok("Course credits populated successfully");
    //     } catch (IOException e) {
    //         e.printStackTrace();
    //         return ResponseEntity.internalServerError().body("Failed to process the CSV file: " + e.getMessage());
    //     } catch (Exception e) {
    //         e.printStackTrace();
    //         return ResponseEntity.internalServerError().body("An unexpected error occurred: " + e.getMessage());
    //     }
    // }
    

    @PostMapping
    public ResponseEntity<Courses> createCourse(@RequestBody Courses course) {
        return ResponseEntity.ok(coursesService.saveCourse(course));
    }


}
