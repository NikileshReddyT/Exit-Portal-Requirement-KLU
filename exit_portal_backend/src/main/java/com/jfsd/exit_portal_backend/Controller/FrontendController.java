package com.jfsd.exit_portal_backend.Controller;

import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.jfsd.exit_portal_backend.Model.Courses;
import com.jfsd.exit_portal_backend.Model.StudentCategoryProgress;
import com.jfsd.exit_portal_backend.Model.StudentGrade;
import com.jfsd.exit_portal_backend.RequestBodies.InvalidPasswordException;
import com.jfsd.exit_portal_backend.RequestBodies.Login;
import com.jfsd.exit_portal_backend.RequestBodies.Student;
import com.jfsd.exit_portal_backend.RequestBodies.StudentCourseReportDTO;
import com.jfsd.exit_portal_backend.RequestBodies.UserNotFoundException;
import com.jfsd.exit_portal_backend.Service.FrontendService;

@RestController
@RequestMapping("/api/v1/frontend")
public class FrontendController {

    private static final Logger logger = LoggerFactory.getLogger(FrontendController.class);

    @Autowired
    private FrontendService frontendService;

    @PostMapping("/getdata")
    public ResponseEntity<List<StudentCategoryProgress>> getdata(@RequestBody Student request) {
        System.out.println(request.getUniversityId());
        return ResponseEntity.ok(frontendService.getStudentCategoryProgress(request.getUniversityId()));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Login login) {
        logger.info("Login attempt for university ID: {}", login.getUniversityId());
        try {
            Student student = frontendService.authenticateStudent(login.getUniversityId(), login.getPassword());
            logger.info("Login successful for university ID: {}", login.getUniversityId());
            return ResponseEntity.ok(student);
        } catch (UserNotFoundException | InvalidPasswordException e) {
            logger.error("Login failed for university ID: {}. Reason: {}", login.getUniversityId(), e.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(e.getMessage());
        } catch (Exception e) {
            logger.error("An unexpected error occurred during login for university ID: {}", login.getUniversityId(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("An unexpected error occurred. Please try again later.");
        }
    }
    

    @GetMapping("/getcategorydetails/{categoryName}/{studentId}")
    public ResponseEntity<List<StudentGrade>> getCategoryDetails(@PathVariable("categoryName") String categoryName, @PathVariable("studentId") String studentId) {
        System.out.println("Category Name: " + categoryName);
        System.out.println("Student ID: " + studentId);
        List<StudentGrade> courses = frontendService.getCoursesByCategory(studentId, categoryName);
        System.out.println(courses);
        return new ResponseEntity<>(courses, HttpStatus.OK);
    }

    @GetMapping("/getallcourses/{categoryName}")
    public ResponseEntity<List<Courses>> getAllCourses(@PathVariable("categoryName") String categoryName) {
        List<Courses> allCourses = frontendService.getAllCoursesByCategory(categoryName);
        return new ResponseEntity<>(allCourses, HttpStatus.OK);
    }

    @PostMapping("/generatereport")
    public ResponseEntity<StudentCourseReportDTO> generateStudentReport(@RequestBody Map<String, String> requestBody) {
        String universityId = requestBody.get("universityId");
        if (universityId == null) {
            return ResponseEntity.badRequest().body(null);
        }

        StudentCourseReportDTO reportDTO = frontendService.generateStudentReport(universityId);
        return ResponseEntity.ok(reportDTO);
    }
}
