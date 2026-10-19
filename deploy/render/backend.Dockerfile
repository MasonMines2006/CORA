FROM python:3.12-slim

WORKDIR /code

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        cmake \
        git \
        libgl1 \
        libglib2.0-0 \
        libglx-mesa0 \
        libgomp1 \
        libmagic1 \
        libreoffice \
        poppler-utils \
        tesseract-ocr \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

ENV LD_LIBRARY_PATH=/usr/lib/x86_64-linux-gnu
ENV NLTK_DATA=/usr/local/nltk_data
ENV PYTHONUNBUFFERED=1

COPY backend/requirements.txt backend/constraints.txt /tmp/
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r /tmp/requirements.txt -c /tmp/constraints.txt

# Download the local embedding model during the image build so deploys do not
# depend on Hugging Face being reachable when the container starts.
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2').save('/code/local_model')" \
    && python -m nltk.downloader -d /usr/local/nltk_data punkt averaged_perceptron_tagger

COPY backend/ /code/
COPY deploy/render/start_backend.py /opt/cora/start_backend.py

EXPOSE 10000
CMD ["python", "/opt/cora/start_backend.py"]
