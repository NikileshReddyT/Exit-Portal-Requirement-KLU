package com.jfsd.exit_portal_backend.Controller;

import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.jfsd.exit_portal_backend.Model.Student;
import com.jfsd.exit_portal_backend.Service.StudentCredentialsService;

@RestController
@RequestMapping("/api/credentials")
public class StudentCredentialsController {

    @Autowired
    private StudentCredentialsService studentCredentialsService;

    // Endpoint to generate credentials
    @GetMapping("/generate")
    public List<Student> generateCredentials() {
        return studentCredentialsService.generateAndSaveUniqueStudentCredentials();
    }

    @GetMapping("/get")
    public List<Student> getCredentials() {
        return studentCredentialsService.getStudentCredentials();
    }



    @PostMapping("/populate")
    public ResponseEntity<String> populateCredentialsFromCSV(@RequestParam("file") MultipartFile file) {
        return studentCredentialsService.populateCredentialsFromCSV(file);
    }
}
