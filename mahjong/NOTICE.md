# 라이선스 고지 (NOTICE)

## 이 앱
GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later). 전문: [LICENSE](LICENSE).
대응하는 소스 코드: [SOURCE.md](SOURCE.md).

## Mortal 런타임 (libriichi)
- 원저작: Equim-chan, <https://github.com/Equim-chan/Mortal>, AGPL-3.0-or-later.
- 이 앱의 `vendor/core/mortal_wasm_core_bg.wasm`은 위 소스 중 상태 추적/관측 인코딩 부분만 WebAssembly로 빌드한 파생물입니다.
  변경 사항: Python 바인딩(PyO3/numpy), 멀티스레드·파일 입출력 관련 의존성 제거, wasm-bindgen 인터페이스 추가.
  (빌드 입력은 Mortal-S42 배포본의 runtime/ 디렉터리, upstream commit 0cff2b52982be5b1163aa9a62fb01f03ce91e0d2.)

## Mortal 모델 가중치 (엔진)
### Mortal-S42 · int8 가중치 + QAT  (id: `mortal-s42-q8`)
- 원본: Mortal-S42 (S42.8k), Hugging Face haor/Mortal-S42, Apache-2.0 — <https://www.apache.org/licenses/LICENSE-2.0>
- **변경됨(Apache-2.0 §4(b))**: `model/mortal-s42-q8/mortal.onnx` — ONNX 변환, 합성곱 가중치 int8(채널별) 양자화, 나머지 fp16 저장, 원본을 교사로 한 증류 미세조정(QAT). 입력은 공개 대국 로그에서 만든 관측 텐서(로그 자체는 포함하지 않음). 몸체 특징(phi)을 추가 출력으로 노출하도록 출력 노드 하나만 더했다(가중치 불변). 스타일 헤드(styles.json/bin)를 함께 배포한다.
- 모델 파일 sha256: `fcb50c8c95beb0cdcb2afd13f79e2d56ab7c29082d7b6523d5c05d9d7c9e715f`
- 스타일 헤드(`model/mortal-s42-q8/styles.json`, `mortal-s42-q8/styles.bin`): 천봉명인전·천봉위 공개 대국으로 학습한 보정 계수(선수/군집의 선호를 Mortal 의 Q 에 더하는 작은 행렬). 대국 데이터와 선수 이름은 포함하지 않으며 채점에는 쓰지 않는 참고 표시용입니다.

## 패 이미지
`v4/tiles/libre/*.svg` — libreriichi-assets (<https://codeberg.org/davidgomez/libreriichi-assets>), **CC0 1.0** (퍼블릭 도메인).
패별 개별 SVG로 추출한 것이며 라이선스 사본은 `v4/tiles/libre/LICENSE-CC0.txt`에 있습니다.

## onnxruntime-web
MIT License, Microsoft. `vendor/ort/`.

## 데이터
이 배포물에는 대국 로그가 포함되어 있지 않습니다. 사용자가 설정한 저장소/파일에서 브라우저가 직접 읽습니다.
