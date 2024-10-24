package com.jfsd.exit_portal_backend.Controller;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
// import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.jfsd.exit_portal_backend.Model.StudentCategoryProgress;
import com.jfsd.exit_portal_backend.Model.StudentGrade;
import com.jfsd.exit_portal_backend.RequestBodies.Login;
import com.jfsd.exit_portal_backend.RequestBodies.Student;
import com.jfsd.exit_portal_backend.Service.FrontendService;
@RestController
@RequestMapping("/api/v1/frontend")
public class FrontendController {

    @Autowired
    private FrontendService frontendService;

    @PostMapping("/getdata")
    public ResponseEntity<List<StudentCategoryProgress>> getdata(@RequestBody Login request) {
        System.out.println(request.getUniversityid());
        return ResponseEntity.ok(frontendService.getStudentCategoryProgress(request.getUniversityid()));

    }

    @PostMapping("/login")
    public ResponseEntity<Student> login(@RequestBody Login loginRequest) {
        Student student = frontendService.findStudentByUniversityId(loginRequest.getUniversityid());
        if (student != null) {
            return ResponseEntity.ok(student); // Return student data if found
        } else {
            return ResponseEntity.status(404).body(null); // Return 404 if student not found
        }
    }

    @GetMapping("/getcategorydetails/{categoryName}/{studentId}")
public ResponseEntity<List<StudentGrade>> getCategoryDetails(@PathVariable("categoryName") String categoryName, @PathVariable("studentId") String studentId){
        System.out.println("Category Name: " + categoryName);
        System.out.println("Student ID: " + studentId);
        List<StudentGrade> courses = frontendService.getCoursesByCategory(studentId, categoryName);
        System.out.println(courses);
        return new ResponseEntity<>(courses, HttpStatus.OK);
    }



}
