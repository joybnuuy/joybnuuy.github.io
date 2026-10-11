# 소스 코드

이 앱(및 wasm 모듈)에 대응하는 소스 코드: https://github.com/joybnuuy/FastMahjongTrainer

- `v5/public/` — 런처, 화면(`v4/`, `v1/`), 코어(`core/`: 데이터 제공자, 설정, 오답노트)
- `web-mortal/wasm-core/` — libriichi 파생 wasm 코어 (AGPL-3.0-or-later)
- `web-mortal/derive_core.py` — upstream에서 필요한 부분을 추출·변환하는 스크립트
- `web-mortal/export_onnx.py`, `quantize.py`, `weight_only.py`, `qat.py` — 모델 변환/양자화/미세조정
