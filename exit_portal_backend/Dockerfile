# Build stage
FROM jelastic/maven:3.9.5-openjdk-21 AS build
WORKDIR /app

# Copy pom.xml first for dependency caching
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copy source and build
COPY src ./src
RUN mvn clean package -DskipTests

# Runtime stage - Use JRE instead of JDK
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

COPY --from=build /app/target/*.jar /app/demo.jar

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/demo.jar"]
