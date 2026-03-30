FROM gcc:latest
WORKDIR /app
COPY ./code/main.cpp /app/
CMD ["sh", "-c", "g++ main.cpp -o main.out && ./main.out"]
