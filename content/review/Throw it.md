---
tags:
  - review
---
# Git
https://github.com/mjmj1/InD_GameJam_2
# InputSystem.cs
``` c#
public class InputSystem : MonoBehaviour
{
    public static InputSystem Instance;
    private bool isDragging;
  
    private void Awake()
    {
        if (!Instance)
        {
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }
        else if (Instance != this)
        {
            Destroy(gameObject);
        }
    }
    
    private void Update()  
    {
        var mousePos = Input.mousePosition;
  
        switch (isDragging)  
        {
            case false when Input.GetMouseButtonDown(0):
                isDragging = true;
                OnMouseButtonDown?.Invoke(mousePos);
                break;
            case true when Input.GetMouseButton(0):
                OnMouseButtonHold?.Invoke(mousePos);
                break;
            case true when Input.GetMouseButtonUp(0):
                isDragging = false;
                OnMouseButtonUp?.Invoke(mousePos);
                break;
        }
    }
    public event Action<Vector2> OnMouseButtonDown;
    public event Action<Vector2> OnMouseButtonHold;
    public event Action<Vector2> OnMouseButtonUp;
}
```
- new Input System을 사용하기엔 단순 마우스 조작만 있었기에 과하다고 판단했기에 간단하게 InputSystem을 구현
# Thrower.cs
``` c#
public class Thrower : MonoBehaviour  
{
	// 생략
	
    protected Vector2 ThrowDirection;
    protected float ThrowForce;
    protected bool IsThrown = false;
    private Vector2 _startPosition;

    public event Action OnThrow;
    
    protected virtual void Start()  
    {
        InputSystem.Instance.OnMouseButtonDown += OnMouseButtonDown;
        InputSystem.Instance.OnMouseButtonHold += OnMouseButtonHold;
        InputSystem.Instance.OnMouseButtonUp += OnMouseButtonUp;
    }
    
    protected virtual void OnDestroy()  
    {
        InputSystem.Instance.OnMouseButtonDown -= OnMouseButtonDown;
        InputSystem.Instance.OnMouseButtonHold -= OnMouseButtonHold;
        InputSystem.Instance.OnMouseButtonUp -= OnMouseButtonUp;
    }
    
    protected virtual void OnMouseButtonDown(Vector2 mousePosition)
    {
        if (IsThrown) return;
        _startPosition = mousePosition;
    }
    
    protected virtual void OnMouseButtonHold(Vector2 mousePosition)  
    {
        if (IsThrown) return;
         
        var offset = _startPosition - mousePosition;
  
        ThrowDirection = offset.normalized;
        ThrowForce = Mathf.InverseLerp(0, 1000, offset.magnitude) * maxThrowForce;
    }
    
    protected virtual void OnMouseButtonUp(Vector2 mousePosition)
    {
        IsThrown = true;
        OnThrow?.Invoke();
    }
}
```
- 던질 수 있는 것들에 코드 중복을 피하기 위해 Thrower 라는 부모 클래스를 생성하고 이를 상속받는 클래스를 구현
- OnMouseButtonUp 도 if (IsThrown) return; 처리를 했어야 했음
``` c#
public class MultiThrower : Thrower  
{
    // 생략
    [SerializeField] private float throwDelay = 0.1f;
    private WaitForSeconds _wait;

    protected override void OnMouseButtonUp(Vector2 mousePosition)  
	{  
	    if (IsThrown) return;  
	    base.OnMouseButtonUp(mousePosition);  
	    StartCoroutine(ShootRoutine());
	}  

	private IEnumerator ShootRoutine()  
	{
	    for (var i = 0; i < throwableCount; i++)  
	    {
	        Spawn();
	  
	        var throwable = currentThrowable.GetComponent<Throwable>();  
	                throwable.Throw(ThrowDirection, ThrowForce, 40f);  
	  
	        yield return _wait;  
	    }
	}
    
    // 생략
}
```
- 던질 때 여러 개를 던질 수 있도록 상속 후 오버라이딩
# Throwable.cs
``` c#
public class Throwable : MonoBehaviour
{
	[Range(0f, 1f)]
	[SerializeField] protected float restitution = 1f;

	protected virtual void OnCollisionEnter2D(Collision2D collision)
	{
		if (!collision.collider.CompareTag("Failed")) return;
		
		// 실패 처리
		
		if (!collision.collider.CompareTag("Target")) return;

		var interactable = collision.collider.GetComponent<Interactable>();
		interactable.Interact(collision);
		Interact();
	}

	protected virtual void OnTriggerEnter2D(Collider2D other)
	{
		if (!other.CompareTag("Target")) return;

		var interactable = other.GetComponent<Interactable>();
		interactable.Interact(null);
		Interact();
	}

	public void Throw(Vector2 throwDirection, float throwForce, float spreadAngle = 0f)
	{
		if (IsThrown) return;

		IsThrown = true;

		var direction = Spread(throwDirection, spreadAngle);
		
		Rb.AddForce(direction * throwForce, ForceMode2D.Impulse);
	}

	private Vector2 Spread(Vector2 throwDirection, float spreadAngle)
	{
		if (spreadAngle == 0f) return throwDirection;
		
		var halfAngle = spreadAngle * 0.5f;
		var randomAngle = Random.Range(-halfAngle, halfAngle);
		
		return Quaternion.Euler(0, 0, randomAngle) * throwDirection;
	}

	public void Torque(float torque)
	{
		Rb.AddTorque(torque);
	}

	protected virtual void Interact()
	{
		StopToCollision();
	}

	public void StopToCollision()
	{
		Rb.velocity = Vector2.zero;
		Rb.angularVelocity = 0f;
		
		Rb.constraints = RigidbodyConstraints2D.FreezePosition;
	}

	public void Bound(Vector2 normal)
	{
		var incomingVel = Rb.velocity;

		var reflectedVel = Vector2.Reflect(incomingVel, normal);

		Rb.velocity = reflectedVel * restitution;
	}
}
```
- 다양한 효과들을 미리 정의하고 파생 클래스마다 다른 효과를 선택해서 사용하도록 구현
- Interact() 부분에서 함수를 완전히 비워서 만들었어야 팀원들이 덜 헷갈려했을 듯함 -> 코드가 너무 과했음
# Interactable.cs
``` c#
public class Interactable : MonoBehaviour
{
	protected SpriteRenderer Sprite;
	protected Collider2D Col;
	protected Rigidbody2D Rb;

	protected virtual void Awake()
	{
		Sprite = GetComponent<SpriteRenderer>();
		Col = GetComponent<Collider2D>();
		Rb = GetComponent<Rigidbody2D>();
	}
	
	public virtual void Interact(Collision2D collision)
	{
		
	}
}
```
- Throwable 이 날라가서 상호작용 하는 물체에 들어가는 스크립트
- 아래의 두 코드를 봤을 때, 성공 판정에 대한 코드도 넣어뒀어야 했음
``` c#
public class MakeBurger : Interactable
{
    
    // 생략
    
	private void FixedUpdate()
	{
		if (_hasEntered && !_isClear)
		{
			_elapsed += Time.fixedDeltaTime;

			if (!(_elapsed >= targetTime)) return;
			StageManager.Instance.StageClear();
			_isClear = true;
		}
	}

	private void OnTriggerEnter2D(Collider2D other)
	{
		if (other.CompareTag("Failed")) StageManager.Instance.StageRestart();
		if (!other.CompareTag("Throwable")) return;

		_elapsed = 0f;
		_hasEntered = true;
	}

	private void OnTriggerExit2D(Collider2D other)
	{
		if (!_hasEntered) return;

		_elapsed = 0f;
		_hasEntered = false;
	}
	
	// 생략
	
}
```

``` c#
using System.Collections;
using UnityEngine;
using Random = UnityEngine.Random;

namespace Interactables
{
    public class MoveTruck : Interactable
    {
		// 생략
		
        private void OnTriggerEnter2D(Collider2D other)
        {
            if (!other.CompareTag("Throwable")) return;

            _elapsed = 0f;
            _hasEntered = true;
        }

        private void OnTriggerExit2D(Collider2D other)
        {
            if (!other.CompareTag("Throwable")) return;
            
            if (!_hasEntered) return;
            
            _elapsed = 0f;
            _hasEntered = false;
        }

        private void OnTriggerStay2D(Collider2D other)
        {
            if (!_hasEntered) return;
            if (!other.CompareTag("Throwable")) return;
            if (other.GetComponent<Rigidbody2D>().velocity.magnitude > 3f)
            {
                _elapsed = 0f;
                return;
            }
            
            _elapsed += Time.fixedDeltaTime;
            
            if (!(_elapsed >= targetTime)) return;

            StageManager.Instance.StageClear();
            
            _hasEntered = false;
        }
        
        // 생략
    }
}
```