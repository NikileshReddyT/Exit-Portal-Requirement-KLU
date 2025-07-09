package com.jfsd.exit_portal_backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.web.bind.annotation.CrossOrigin;



@SpringBootApplication
@EnableAsync
@CrossOrigin(origins = {"http://127.0.0.1:5501", "http://localhost:5173","https://exit-portal-requirement-klu.vercel.app/","https://exitportal-klu.vercel.app/"})
public class ExitPortalBackendApplication {
	public static void main(String[] args) {
		SpringApplication.run(ExitPortalBackendApplication.class, args);
	}

}
