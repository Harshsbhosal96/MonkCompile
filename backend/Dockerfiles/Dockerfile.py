FROM python:latest
WORKDIR /app
COPY ./code/main.py /app/
CMD ["python", "main.py"]
