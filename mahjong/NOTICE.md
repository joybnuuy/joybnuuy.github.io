# 라이선스 고지 (NOTICE)

## 이 앱
GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later). 전문: [LICENSE](LICENSE).
대응하는 소스 코드: [SOURCE.md](SOURCE.md).

## Mortal 런타임 (libriichi)
- 원저작: Equim-chan, <https://github.com/Equim-chan/Mortal>, AGPL-3.0-or-later.
- 이 앱의 `mortal_wasm_core.wasm`은 위 소스 중 상태 추적/관측 인코딩 부분만 WebAssembly로 빌드한 파생물입니다.
  변경 사항: Python 바인딩(PyO3/numpy), 멀티스레드·파일 입출력 관련 의존성 제거, wasm-bindgen 인터페이스 추가.
  (빌드 입력은 Mortal-S42 배포본의 runtime/ 디렉터리, upstream commit 0cff2b52982be5b1163aa9a62fb01f03ce91e0d2.)

## Mortal 모델 가중치
- 원본: Mortal-S42 (체크포인트 S42.8k), Hugging Face `haor/Mortal-S42`, Apache-2.0 — <https://www.apache.org/licenses/LICENSE-2.0>.
- **변경됨(Apache-2.0 §4(b))**: `model/mortal.onnx`는 원본 가중치를 ONNX로 변환하고, 대부분의 합성곱 가중치를 int8(채널별)로,
  나머지를 fp16으로 저장하며, 양자화 오차를 줄이기 위해 원본 모델을 교사로 한 증류 미세조정(QAT)을 거친 파생물입니다.
  미세조정 입력으로 공개 대국 로그에서 만든 관측 텐서를 사용했으나 로그 자체는 포함하지 않습니다.
- 모델 파일 sha256: `4715eb1778a6e074002dc92a7c80157cacc0ef120700b646a6cc855ed795e207`

## onnxruntime-web
MIT License, Microsoft. `vendor/ort/`.

## 데이터
이 배포물에는 대국 로그가 포함되어 있지 않습니다. 사용자가 설정한 저장소/파일에서 브라우저가 직접 읽습니다.
