package com.jfsd.exit_portal_backend.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;

public class Login {
    @JsonProperty("universityId")
    @JsonAlias({"universityid", "studentId", "id"})
    private String universityId;
    private String password;

    public String getUniversityId() { return universityId; }
    public void setUniversityId(String universityId) { this.universityId = universityId; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
}
