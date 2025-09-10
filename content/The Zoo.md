> [!CAUTION]
> 스크립트의 전체 코드를 넣지 않고 일부 코드들은 생략되어 있습니다.
# InputHandler.cs
``` c#
internal class InputHandler : MonoBehaviour
{
	public Vector2 MoveInput { get; private set; }
	public Vector2 LookInput { get; private set; }
	
	private void Awake()  
	{
	    InputActions = new PlayerInputActions();
	    
	    InputActions.Player.Move.performed += ctx => MoveInput = ctx.ReadValue<Vector2>();
	    InputActions.Player.Move.canceled += ctx => MoveInput = Vector2.zero;
	    
	    InputActions.Player.Look.performed += ctx => LookInput = ctx.ReadValue<Vector2>();
	    InputActions.Player.Look.canceled += ctx => LookInput = Vector2.zero;
	}
}
```
- Input System을 활용하여 이벤트 기반으로 매 프레임 마다 호출하는 대신 `performed/canceled` 이벤트로 불필요 연산을 최소화할 수 있음
- 추가적인 동작을 정의하고 싶다면 인터페이스만 맞춰서 구독하면 동작하므로 확장성이 좋음
# PlanetGravity.cs
``` c#
public class PlanetGravity : MonoBehaviour
{
    public static PlanetGravity Instance { get; private set; }
  
    private readonly float gravityStrength = 9.81f;
    private readonly HashSet<Rigidbody> affectedBodies = new();
  
    private void Awake()  
    {
        if (!Instance) Instance = this;  
        else Destroy(gameObject);
    }
    
    private void FixedUpdate()  
	{  
	    ApplyGravity();  
	}
    
    private void ApplyGravity()
	{
	    foreach (var rb in affectedBodies)
	    {
	        if (!rb) continue;
	        rb.AddForce(GetGravityDirection(rb.position) * gravityStrength, ForceMode.Acceleration);  
	    }
	}
	
	public Vector3 GetGravityDirection(Vector3 position)
	{  
	    return (transform.position - position).normalized;  
	}
	
	public void Subscribe(Rigidbody rb)  
	{  
	    if (rb) affectedBodies.Add(rb);
	}  
	  
	public void Unsubscribe(Rigidbody rb)  
	{  
	    if (rb) affectedBodies.Remove(rb);
	}
}
```
- 구(球) 형태의 맵을 돌아다니는 것으로 기획을 하였기 때문에 기본 중력을 사용하지 않고 직접 구현한 중력을 사용함
- 싱글톤 패턴을 사용하여 오직 하나만 존재하는 것을 보장하며 `PlanetGravity.Instance`으로 간단하게 접근 가능
- 구독 형식으로 구현하여 힘을 받는 오브젝트를 동적으로 관리할 수 있도록 함
- 구 형태의 게임 오브젝트에 부착하면 효과를 받는 오브젝트로부터 구 형태의 게임 오브젝트의 중심으로 일정 간격마다 힘이 가해짐
# PlayerController.cs
``` c#
public class PlayerController : NetworkTransform  
{
	... // 중략
	
	private void Update()  
	{  
	    if (!IsOwner) return;  
	  
	    AlignToSurface();  
	}
	
	private void AlignToSurface()  
	{  
	    if (!PlanetGravity.Instance) return;  
	  
	    var gravityDirection = -PlanetGravity.Instance.GetGravityDirection(transform.position);  
	  
	    var targetRotation = Quaternion.FromToRotation(  
	        transform.up, gravityDirection) * transform.rotation;  
	    transform.rotation = Quaternion.Slerp(  
	        transform.rotation, targetRotation, rotationSpeed * Time.deltaTime);  
	}
	
	... // 중략
}
```
- 구 형태의 맵에 맞춰 지속적으로 플레이어의 Y축을 정렬
# RoleManager.cs
``` c#
public struct PlayerData : INetworkSerializable, IEquatable<PlayerData>  
{  
    public ulong ClientId;
    public FixedString32Bytes Name;
    public int AnimalIndex;
  
    public PlayerData(ulong id, FixedString32Bytes name, int index)  
    {
        ClientId = id;  
        Name = name;  
        AnimalIndex = index;  
    }  
    public bool Equals(PlayerData other)  
    {
        return ClientId == other.ClientId && Name.Equals(other.Name) && 
        AnimalIndex.Equals(other.AnimalIndex);  
    }  
    public void NetworkSerialize<T>(BufferSerializer<T> serializer) where T : IReaderWriter  
    {  
        serializer.SerializeValue(ref ClientId);  
        serializer.SerializeValue(ref Name);  
        serializer.SerializeValue(ref AnimalIndex);  
    }
}
```
- 네트워크에 동기화될 데이터를 정의한 구조체

``` c#
public class RoleManager : NetworkBehaviour  
{  
    public NetworkList<PlayerData> HiderIds = new();  
    public NetworkList<PlayerData> SeekerIds = new();
    
    internal void AssignRole()  
	{  
	    var clients = NetworkManager.Singleton.ConnectedClientsList;  
	    var seeker = Random.Range(0, clients.Count);  
	  
	    for (var i = 0; i < clients.Count; i++)  
	    {
	        var entity = clients[i].PlayerObject.GetComponent<PlayerEntity>();  
	  
	        var playerName = entity.playerName.Value;  
	        var index = entity.animalIndex.Value;  
	  
	        var data = new PlayerData(clients[i].ClientId, playerName, index);  
	  
	        if (seeker == i)  
	            SeekerIds.Add(data);  
	        else  
	            HiderIds.Add(data);  
	    }
	}
}
```
- 인게임 진입 시 플레이어들에게 역할(Hider, Seeker)를 부여하는 스크립트
- 자동으로 동기화해주는 NetworkList를 사용하였고, NetworkList는 INetworkSerializable, IEquatable을 상속받은 값만 받을 수 있음