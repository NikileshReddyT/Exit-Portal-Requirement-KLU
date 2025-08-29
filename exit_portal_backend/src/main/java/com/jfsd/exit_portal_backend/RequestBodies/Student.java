package com.jfsd.exit_portal_backend.RequestBodies;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;

public class Student {

    @JsonProperty("universityid")
    @JsonAlias({"universityid", "studentId"})
    private String universityId;

    @JsonProperty("studentName")
    @JsonAlias({"studentName", "studentName"})
    private String studentName;

    public String getUniversityId() {
        return universityId;
    }

    public void setUniversityId(String universityId) {
        this.universityId = universityId;
    }

    public String getStudentName() {
        return studentName;
    }

    public void setStudentName(String studentName) {
        this.studentName = studentName;
    }
}
